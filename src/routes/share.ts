import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get shared estimate data (PUBLIC - no auth)
router.get('/estimate/:shareToken', async (req: Request, res: Response) => {
  try {
    const shareToken = req.params.shareToken as string;

    const estimate = await prisma.savedEstimate.findUnique({
      where: { shareToken },
      include: {
        carrier: {
          select: { name: true },
        },
        user: {
          select: { name: true },
        },
      },
    });

    if (!estimate || !estimate.isPublic) {
      res.status(404).json({ error: 'Estimate not found or not shared' });
      return;
    }

    res.json({
      id: estimate.id,
      name: estimate.name,
      originCountry: estimate.originCountry,
      userCount: estimate.userCount,
      callsPerUserPerMonth: estimate.callsPerUserPerMonth,
      avgMinutesPerCall: estimate.avgMinutesPerCall,
      destinations: estimate.destinations,
      carrierId: estimate.carrierId,
      carrierName: estimate.carrier?.name || null,
      results: estimate.results,
      notes: estimate.notes,
      sharedBy: estimate.user?.name || 'Anonymous',
      createdAt: estimate.createdAt,
      updatedAt: estimate.updatedAt,
    });
  } catch (error) {
    console.error('Get shared estimate error:', error);
    res.status(500).json({ error: 'Failed to fetch shared estimate' });
  }
});

// Recalculate with modified inputs (PUBLIC - for viewer interactivity)
router.post('/estimate/:shareToken/calculate', async (req: Request, res: Response) => {
  try {
    const shareToken = req.params.shareToken as string;
    const {
      originCountry,
      userCount,
      callsPerUserPerMonth,
      avgMinutesPerCall,
      destinations,
      carrierId,
    } = req.body;

    // Verify the share token exists and is public
    const estimate = await prisma.savedEstimate.findUnique({
      where: { shareToken },
    });

    if (!estimate || !estimate.isPublic) {
      res.status(404).json({ error: 'Estimate not found or not shared' });
      return;
    }

    // Validate inputs
    if (!originCountry || !userCount || !callsPerUserPerMonth || !avgMinutesPerCall || !destinations) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Get rates for the origin country, optionally filtered by carrier
    const rateFilter: any = { originCountry: originCountry };
    if (carrierId) {
      rateFilter.carrierId = parseInt(carrierId);
    }
    const rates = await prisma.rateMatrix.findMany({
      where: rateFilter,
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
        carrierId: carrierId ? parseInt(carrierId) : null,
      },
      breakdown,
    });
  } catch (error) {
    console.error('Shared calculate error:', error);
    res.status(500).json({ error: 'Failed to calculate estimate' });
  }
});

// Get origin options for dropdown (PUBLIC)
router.get('/estimate/:shareToken/origins', async (req: Request, res: Response) => {
  try {
    const shareToken = req.params.shareToken as string;

    // Verify the share token exists and is public
    const estimate = await prisma.savedEstimate.findUnique({
      where: { shareToken },
    });

    if (!estimate || !estimate.isPublic) {
      res.status(404).json({ error: 'Estimate not found or not shared' });
      return;
    }

    const origins = await prisma.rateMatrix.findMany({
      select: {
        originCountry: true,
      },
      distinct: ['originCountry'],
    });

    const countries = [...new Set(origins.map(o => o.originCountry))].sort();

    res.json(countries);
  } catch (error) {
    console.error('Shared origins error:', error);
    res.status(500).json({ error: 'Failed to fetch origins' });
  }
});

// Get destination options (PUBLIC)
router.get('/estimate/:shareToken/destinations', async (req: Request, res: Response) => {
  try {
    const shareToken = req.params.shareToken as string;

    // Verify the share token exists and is public
    const estimate = await prisma.savedEstimate.findUnique({
      where: { shareToken },
    });

    if (!estimate || !estimate.isPublic) {
      res.status(404).json({ error: 'Estimate not found or not shared' });
      return;
    }

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
    console.error('Shared destinations error:', error);
    res.status(500).json({ error: 'Failed to fetch destinations' });
  }
});

// Get carrier options (PUBLIC)
router.get('/estimate/:shareToken/carriers', async (req: Request, res: Response) => {
  try {
    const shareToken = req.params.shareToken as string;

    // Verify the share token exists and is public
    const estimate = await prisma.savedEstimate.findUnique({
      where: { shareToken },
    });

    if (!estimate || !estimate.isPublic) {
      res.status(404).json({ error: 'Estimate not found or not shared' });
      return;
    }

    // Get carriers that have rates
    const carriersWithRates = await prisma.carrier.findMany({
      where: {
        rateMatrices: {
          some: {},
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json(carriersWithRates);
  } catch (error) {
    console.error('Shared carriers error:', error);
    res.status(500).json({ error: 'Failed to fetch carriers' });
  }
});

export default router;
