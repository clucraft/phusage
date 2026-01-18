import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Get available templates (origin countries with call data)
router.get('/templates', async (req: AuthRequest, res: Response) => {
  try {
    const { year } = req.query;
    const selectedYear = year ? Number(year) : new Date().getFullYear();

    const startDate = new Date(selectedYear, 0, 1);
    const endDate = new Date(selectedYear, 11, 31, 23, 59, 59);

    // Get all calls grouped by origin country for the selected year
    const callsByOrigin = await prisma.callRecord.groupBy({
      by: ['originCountry'],
      where: {
        callDate: {
          gte: startDate,
          lte: endDate,
        },
        originCountry: {
          not: null,
        },
      },
      _count: {
        id: true,
      },
    });

    // Get unique users per origin country
    const templates = await Promise.all(
      callsByOrigin.map(async (item) => {
        if (!item.originCountry) return null;

        const uniqueUsers = await prisma.callRecord.findMany({
          where: {
            originCountry: item.originCountry,
            callDate: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: {
            userEmail: true,
          },
          distinct: ['userEmail'],
        });

        return {
          country: item.originCountry,
          userCount: uniqueUsers.length,
          callCount: item._count.id,
          year: selectedYear,
        };
      })
    );

    // Filter out nulls and sort by call count
    const validTemplates = templates
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => b.callCount - a.callCount);

    res.json(validTemplates);
  } catch (error) {
    console.error('Templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get available years that have call data
router.get('/years', async (req: AuthRequest, res: Response) => {
  try {
    const calls = await prisma.callRecord.findMany({
      select: {
        callDate: true,
      },
      distinct: ['callDate'],
    });

    const years = [...new Set(calls.map(c => c.callDate.getFullYear()))].sort((a, b) => b - a);

    res.json(years);
  } catch (error) {
    console.error('Years error:', error);
    res.status(500).json({ error: 'Failed to fetch years' });
  }
});

// Get template data for a specific origin country
router.get('/template/:country', async (req: AuthRequest, res: Response) => {
  try {
    const country = req.params.country as string;
    const { year } = req.query;
    const selectedYear = year ? Number(year) : new Date().getFullYear();

    const startDate = new Date(selectedYear, 0, 1);
    const endDate = new Date(selectedYear, 11, 31, 23, 59, 59);

    // Get all calls from this origin country
    const calls = await prisma.callRecord.findMany({
      where: {
        originCountry: country,
        callDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        userEmail: true,
        destCountry: true,
        duration: true,
        callDate: true,
      },
    });

    if (calls.length === 0) {
      res.status(404).json({ error: 'No call data found for this template' });
      return;
    }

    // Calculate unique users
    const uniqueUsers = new Set(calls.map(c => c.userEmail));
    const userCount = uniqueUsers.size;

    // Calculate destination distribution
    const destCounts: Record<string, { calls: number; totalDuration: number }> = {};
    let totalCalls = 0;
    let totalDuration = 0;

    for (const call of calls) {
      const dest = call.destCountry || 'Unknown';
      if (!destCounts[dest]) {
        destCounts[dest] = { calls: 0, totalDuration: 0 };
      }
      destCounts[dest].calls += 1;
      destCounts[dest].totalDuration += call.duration;
      totalCalls += 1;
      totalDuration += call.duration;
    }

    // Convert to array with percentages
    const destinations = Object.entries(destCounts)
      .map(([country, data]) => ({
        country,
        calls: data.calls,
        percentage: Math.round((data.calls / totalCalls) * 100),
        avgMinutes: Math.round((data.totalDuration / data.calls / 60) * 10) / 10,
      }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10); // Top 10 destinations

    // Recalculate percentages to ensure they sum to 100
    const totalPercentage = destinations.reduce((sum, d) => sum + d.percentage, 0);
    if (totalPercentage !== 100 && destinations.length > 0) {
      // Adjust the largest one to make it sum to 100
      destinations[0].percentage += (100 - totalPercentage);
    }

    // Calculate averages
    const avgCallsPerUser = Math.round((totalCalls / userCount) * 10) / 10;
    const avgMinutesPerCall = Math.round((totalDuration / totalCalls / 60) * 10) / 10;

    // Calculate months in range with data
    const monthsWithData = new Set(calls.map(c => {
      const d = new Date(c.callDate);
      return `${d.getFullYear()}-${d.getMonth()}`;
    })).size;

    const avgCallsPerUserPerMonth = Math.round((totalCalls / userCount / Math.max(monthsWithData, 1)) * 10) / 10;

    res.json({
      originCountry: country,
      year: selectedYear,
      userCount,
      totalCalls,
      avgCallsPerUserPerMonth,
      avgMinutesPerCall,
      destinations,
    });
  } catch (error) {
    console.error('Template data error:', error);
    res.status(500).json({ error: 'Failed to fetch template data' });
  }
});

// Calculate cost estimate
router.post('/calculate', async (req: AuthRequest, res: Response) => {
  try {
    const {
      originCountry,
      userCount,
      callsPerUserPerMonth,
      avgMinutesPerCall,
      destinations, // Array of { country, percentage }
    } = req.body;

    // Validate inputs
    if (!originCountry || !userCount || !callsPerUserPerMonth || !avgMinutesPerCall || !destinations) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Get rates for the origin country
    const rates = await prisma.rateMatrix.findMany({
      where: {
        originCountry: originCountry,
      },
    });

    // Calculate total monthly calls and minutes
    const totalMonthlyCallsPerUser = callsPerUserPerMonth;
    const totalMonthlyCalls = userCount * totalMonthlyCallsPerUser;
    const totalMonthlyMinutes = totalMonthlyCalls * avgMinutesPerCall;

    // Calculate costs per destination
    const breakdown = [];
    let totalMonthlyCost = 0;

    for (const dest of destinations) {
      const destPercentage = dest.percentage / 100;
      const destCalls = Math.round(totalMonthlyCalls * destPercentage);
      const destMinutes = Math.round(totalMonthlyMinutes * destPercentage);

      // Find rate for this destination
      let rate = rates.find(r => r.destCountry === dest.country);
      if (!rate) {
        // Try to find by destination field
        rate = rates.find(r => r.destination === dest.country);
      }

      const pricePerMinute = rate ? Number(rate.pricePerMinute) : 0;
      const destCost = destMinutes * pricePerMinute;
      totalMonthlyCost += destCost;

      breakdown.push({
        country: dest.country,
        percentage: dest.percentage,
        calls: destCalls,
        minutes: destMinutes,
        ratePerMinute: pricePerMinute,
        monthlyCost: Math.round(destCost * 100) / 100,
        rateFound: !!rate,
      });
    }

    // Sort breakdown by cost
    breakdown.sort((a, b) => b.monthlyCost - a.monthlyCost);

    res.json({
      summary: {
        originCountry,
        userCount,
        callsPerUserPerMonth,
        avgMinutesPerCall,
        totalMonthlyCalls,
        totalMonthlyMinutes: Math.round(totalMonthlyMinutes),
        monthlyCost: Math.round(totalMonthlyCost * 100) / 100,
        yearlyCost: Math.round(totalMonthlyCost * 12 * 100) / 100,
        costPerUser: Math.round((totalMonthlyCost / userCount) * 100) / 100,
      },
      breakdown,
    });
  } catch (error) {
    console.error('Calculate error:', error);
    res.status(500).json({ error: 'Failed to calculate estimate' });
  }
});

// Get all destination countries (for dropdown)
router.get('/destinations', async (req: AuthRequest, res: Response) => {
  try {
    // Get unique destination countries from call records
    const destFromCalls = await prisma.callRecord.findMany({
      select: {
        destCountry: true,
      },
      distinct: ['destCountry'],
    });

    // Get unique destination countries from rate matrix
    const destFromRates = await prisma.rateMatrix.findMany({
      select: {
        destCountry: true,
      },
      distinct: ['destCountry'],
    });

    // Combine and deduplicate
    const allDests = new Set<string>();
    for (const d of destFromCalls) {
      if (d.destCountry) allDests.add(d.destCountry);
    }
    for (const d of destFromRates) {
      if (d.destCountry) allDests.add(d.destCountry);
    }

    const destinations = [...allDests].sort();

    res.json(destinations);
  } catch (error) {
    console.error('Destinations error:', error);
    res.status(500).json({ error: 'Failed to fetch destinations' });
  }
});

// Get all origin countries (for new site country dropdown)
router.get('/origins', async (req: AuthRequest, res: Response) => {
  try {
    // Get unique origin countries from rate matrix (these are countries we have rates for)
    const origins = await prisma.rateMatrix.findMany({
      select: {
        originCountry: true,
      },
      distinct: ['originCountry'],
    });

    const countries = [...new Set(origins.map(o => o.originCountry))].sort();

    res.json(countries);
  } catch (error) {
    console.error('Origins error:', error);
    res.status(500).json({ error: 'Failed to fetch origins' });
  }
});

export default router;
