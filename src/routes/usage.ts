import { Router, Response } from 'express';
import { PrismaClient, RateMatrix } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Helper function to find rate for a call based on geographic matching
async function findRateForCall(
  rates: RateMatrix[],
  originCountry: string | null,
  destCountry: string | null,
  callType: string,
  carrierId?: number
): Promise<number> {
  if (!originCountry || !destCountry) return 0;

  // Filter rates by carrier if specified
  const filteredRates = carrierId
    ? rates.filter(r => r.carrierId === carrierId)
    : rates;

  // Try to find exact match for origin + destCountry + callType
  let rate = filteredRates.find(
    r => r.originCountry === originCountry &&
         r.destCountry === destCountry &&
         r.callType === callType
  );

  // If no exact match, try matching by destination field (for specific destinations like "Afghanistan-Mobile")
  if (!rate) {
    rate = filteredRates.find(
      r => r.originCountry === originCountry &&
           r.destination === destCountry &&
           r.callType === callType
    );
  }

  // Fall back to any rate with matching origin and destCountry (ignore callType)
  if (!rate) {
    rate = filteredRates.find(
      r => r.originCountry === originCountry &&
           r.destCountry === destCountry
    );
  }

  return rate ? Number(rate.pricePerMinute) : 0;
}

// Get usage summary for all users (with optional month filter)
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year, carrierId: carrierIdParam } = req.query;
    const carrierId = carrierIdParam ? parseInt(carrierIdParam as string) : undefined;

    let dateFilter: any = {};
    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0);
      dateFilter = {
        callDate: {
          gte: startDate,
          lte: endDate,
        },
      };
    }

    // Add carrier filter
    if (carrierId) {
      dateFilter.carrierId = carrierId;
    }

    const usageSummary = await prisma.callRecord.groupBy({
      by: ['userEmail', 'userName'],
      where: dateFilter,
      _sum: {
        duration: true,
      },
      _count: {
        id: true,
      },
    });

    // Get all rates for cost calculation
    const rates = await prisma.rateMatrix.findMany();

    // Calculate costs using geographic rate matching
    const summaryWithCosts = await Promise.all(
      usageSummary.map(async (user) => {
        const userCalls = await prisma.callRecord.findMany({
          where: {
            userEmail: user.userEmail,
            ...dateFilter,
          },
          select: {
            callType: true,
            duration: true,
            originCountry: true,
            destCountry: true,
            carrierId: true,
          },
        });

        let totalCost = 0;
        for (const call of userCalls) {
          const rate = await findRateForCall(rates, call.originCountry, call.destCountry, call.callType, call.carrierId);
          totalCost += (call.duration / 60) * rate;
        }

        return {
          userEmail: user.userEmail,
          userName: user.userName,
          totalMinutes: Math.round((user._sum.duration || 0) / 60),
          totalCalls: user._count.id,
          totalCost: Math.round(totalCost * 100) / 100,
        };
      })
    );

    res.json(summaryWithCosts);
  } catch (error) {
    console.error('Usage summary error:', error);
    res.status(500).json({ error: 'Failed to fetch usage summary' });
  }
});

// Get top 10 users by cost
router.get('/top10', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year, startDate: startDateStr, endDate: endDateStr, carrierId: carrierIdParam } = req.query;
    const carrierId = carrierIdParam ? parseInt(carrierIdParam as string) : undefined;

    let dateFilter: any = {};
    // Prefer startDate/endDate if provided, otherwise fall back to month/year
    if (startDateStr && endDateStr) {
      const startDate = new Date(startDateStr as string);
      const endDate = new Date(endDateStr as string);
      endDate.setHours(23, 59, 59, 999);
      dateFilter = {
        callDate: {
          gte: startDate,
          lte: endDate,
        },
      };
    } else if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0);
      dateFilter = {
        callDate: {
          gte: startDate,
          lte: endDate,
        },
      };
    }

    if (carrierId) {
      dateFilter.carrierId = carrierId;
    }

    const usageSummary = await prisma.callRecord.groupBy({
      by: ['userEmail', 'userName'],
      where: dateFilter,
      _sum: {
        duration: true,
      },
    });

    const rates = await prisma.rateMatrix.findMany();

    const summaryWithCosts = await Promise.all(
      usageSummary.map(async (user) => {
        const userCalls = await prisma.callRecord.findMany({
          where: {
            userEmail: user.userEmail,
            ...dateFilter,
          },
          select: {
            callType: true,
            duration: true,
            originCountry: true,
            destCountry: true,
            carrierId: true,
          },
        });

        let totalCost = 0;
        for (const call of userCalls) {
          const rate = await findRateForCall(rates, call.originCountry, call.destCountry, call.callType, call.carrierId);
          totalCost += (call.duration / 60) * rate;
        }

        return {
          userEmail: user.userEmail,
          userName: user.userName,
          totalMinutes: Math.round((user._sum.duration || 0) / 60),
          totalCalls: userCalls.length,
          totalCost: Math.round(totalCost * 100) / 100,
        };
      })
    );

    const top10 = summaryWithCosts
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);

    res.json(top10);
  } catch (error) {
    console.error('Top 10 error:', error);
    res.status(500).json({ error: 'Failed to fetch top 10 users' });
  }
});

// Search for individual user
router.get('/user/:email', async (req: AuthRequest, res: Response) => {
  try {
    const email = req.params.email as string;
    const { startDate: startDateStr, endDate: endDateStr, carrierId: carrierIdParam } = req.query;
    const carrierId = carrierIdParam ? parseInt(carrierIdParam as string) : undefined;

    let dateFilter: any = {};
    if (startDateStr && endDateStr) {
      const startDate = new Date(startDateStr as string);
      const endDate = new Date(endDateStr as string);
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);
      dateFilter = {
        callDate: {
          gte: startDate,
          lte: endDate,
        },
      };
    }

    if (carrierId) {
      dateFilter.carrierId = carrierId;
    }

    const userCalls = await prisma.callRecord.findMany({
      where: {
        userEmail: {
          contains: email,
          mode: 'insensitive',
        },
        ...dateFilter,
      },
      orderBy: {
        callDate: 'desc',
      },
    });

    if (userCalls.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const rates = await prisma.rateMatrix.findMany();

    const totalDuration = userCalls.reduce((sum, call) => sum + call.duration, 0);

    // Calculate total cost and per-call costs using geographic rate matching
    let totalCost = 0;
    const callsWithCosts = [];

    for (const call of userCalls) {
      const rate = await findRateForCall(rates, call.originCountry, call.destCountry, call.callType, call.carrierId);
      const callCost = (call.duration / 60) * rate;
      totalCost += callCost;

      callsWithCosts.push({
        date: call.callDate,
        duration: call.duration,
        type: call.callType,
        sourceNumber: call.sourceNumber,
        destination: call.destination,
        originCountry: call.originCountry,
        destCountry: call.destCountry,
        rate: rate,
        cost: Math.round(callCost * 100) / 100,
      });
    }

    res.json({
      userName: userCalls[0].userName,
      userEmail: userCalls[0].userEmail,
      totalMinutes: Math.round(totalDuration / 60),
      totalCalls: userCalls.length,
      totalCost: Math.round(totalCost * 100) / 100,
      calls: callsWithCosts,
    });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Get user trend data for a date range
router.get('/user/:email/trend', async (req: AuthRequest, res: Response) => {
  try {
    const email = req.params.email as string;
    const { startDate: startDateStr, endDate: endDateStr, carrierId: carrierIdParam } = req.query;
    const carrierId = carrierIdParam ? parseInt(carrierIdParam as string) : undefined;
    const rates = await prisma.rateMatrix.findMany();

    // Default to current year if no dates provided
    const now = new Date();
    const rangeStart = startDateStr ? new Date(startDateStr as string) : new Date(now.getFullYear(), 0, 1);
    const rangeEnd = endDateStr ? new Date(endDateStr as string) : new Date(now.getFullYear(), 11, 31);
    rangeEnd.setHours(23, 59, 59, 999);

    // Calculate the number of months in the range
    const monthsDiff = (rangeEnd.getFullYear() - rangeStart.getFullYear()) * 12 +
                       (rangeEnd.getMonth() - rangeStart.getMonth()) + 1;

    // Get monthly trend data for the range
    const monthlyData = [];
    let currentDate = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);

    for (let i = 0; i < monthsDiff; i++) {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      const callFilter: any = {
        userEmail: {
          contains: email,
          mode: 'insensitive',
        },
        callDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      };
      if (carrierId) {
        callFilter.carrierId = carrierId;
      }

      const calls = await prisma.callRecord.findMany({
        where: callFilter,
        select: {
          duration: true,
          originCountry: true,
          destCountry: true,
          callType: true,
          carrierId: true,
        },
      });

      let totalCost = 0;
      for (const call of calls) {
        const rate = await findRateForCall(rates, call.originCountry, call.destCountry, call.callType, call.carrierId);
        totalCost += (call.duration / 60) * rate;
      }

      monthlyData.push({
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        monthName: monthStart.toLocaleString('default', { month: 'short' }),
        label: `${monthStart.toLocaleString('default', { month: 'short' })} ${currentDate.getFullYear()}`,
        cost: Math.round(totalCost * 100) / 100,
        calls: calls.length,
        minutes: Math.round(calls.reduce((sum, c) => sum + c.duration, 0) / 60),
      });

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Get totals for the entire range
    const rangeFilter: any = {
      userEmail: {
        contains: email,
        mode: 'insensitive',
      },
      callDate: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    };
    if (carrierId) {
      rangeFilter.carrierId = carrierId;
    }

    const rangeCalls = await prisma.callRecord.findMany({
      where: rangeFilter,
      select: {
        duration: true,
        originCountry: true,
        destCountry: true,
        callType: true,
        carrierId: true,
      },
    });

    let rangeCost = 0;
    for (const call of rangeCalls) {
      const rate = await findRateForCall(rates, call.originCountry, call.destCountry, call.callType, call.carrierId);
      rangeCost += (call.duration / 60) * rate;
    }

    res.json({
      monthlyTrend: monthlyData,
      rangeTotal: {
        startDate: rangeStart.toISOString(),
        endDate: rangeEnd.toISOString(),
        totalCost: Math.round(rangeCost * 100) / 100,
        totalCalls: rangeCalls.length,
        totalMinutes: Math.round(rangeCalls.reduce((sum, c) => sum + c.duration, 0) / 60),
      },
    });
  } catch (error) {
    console.error('User trend error:', error);
    res.status(500).json({ error: 'Failed to fetch user trend data' });
  }
});

// Get monthly costs for current year (for chart)
router.get('/monthly-costs', async (req: AuthRequest, res: Response) => {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const carrierIdParam = req.query.carrierId;
    const carrierId = carrierIdParam ? parseInt(carrierIdParam as string) : undefined;
    const rates = await prisma.rateMatrix.findMany();

    const monthlyCosts = [];

    for (let month = 1; month <= 12; month++) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const callFilter: any = {
        callDate: {
          gte: startDate,
          lte: endDate,
        },
      };
      if (carrierId) {
        callFilter.carrierId = carrierId;
      }

      const calls = await prisma.callRecord.findMany({
        where: callFilter,
        select: {
          duration: true,
          originCountry: true,
          destCountry: true,
          callType: true,
          carrierId: true,
        },
      });

      let totalCost = 0;
      for (const call of calls) {
        const rate = await findRateForCall(rates, call.originCountry, call.destCountry, call.callType, call.carrierId);
        totalCost += (call.duration / 60) * rate;
      }

      monthlyCosts.push({
        month,
        monthName: startDate.toLocaleString('default', { month: 'short' }),
        cost: Math.round(totalCost * 100) / 100,
        calls: calls.length,
      });
    }

    res.json(monthlyCosts);
  } catch (error) {
    console.error('Monthly costs error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly costs' });
  }
});

// Get dashboard stats (averages, totals)
router.get('/dashboard-stats', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year, startDate: startDateStr, endDate: endDateStr, carrierId: carrierIdParam } = req.query;
    const carrierId = carrierIdParam ? parseInt(carrierIdParam as string) : undefined;
    const rates = await prisma.rateMatrix.findMany();

    let dateFilter: any = {};
    // Prefer startDate/endDate if provided, otherwise fall back to month/year
    if (startDateStr && endDateStr) {
      const startDate = new Date(startDateStr as string);
      const endDate = new Date(endDateStr as string);
      endDate.setHours(23, 59, 59, 999);
      dateFilter = {
        callDate: {
          gte: startDate,
          lte: endDate,
        },
      };
    } else if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);
      dateFilter = {
        callDate: {
          gte: startDate,
          lte: endDate,
        },
      };
    }

    if (carrierId) {
      dateFilter.carrierId = carrierId;
    }

    const calls = await prisma.callRecord.findMany({
      where: dateFilter,
      select: {
        userEmail: true,
        duration: true,
        originCountry: true,
        destCountry: true,
        callType: true,
        carrierId: true,
      },
    });

    // Calculate total cost
    let totalCost = 0;
    for (const call of calls) {
      const rate = await findRateForCall(rates, call.originCountry, call.destCountry, call.callType, call.carrierId);
      totalCost += (call.duration / 60) * rate;
    }

    // Count unique users
    const uniqueUsers = new Set(calls.map(c => c.userEmail)).size;

    // Calculate totals
    const totalCalls = calls.length;
    const totalMinutes = calls.reduce((sum, c) => sum + c.duration, 0) / 60;

    res.json({
      totalCost: Math.round(totalCost * 100) / 100,
      totalCalls,
      totalMinutes: Math.round(totalMinutes),
      uniqueUsers,
      avgCostPerUser: uniqueUsers > 0 ? Math.round((totalCost / uniqueUsers) * 100) / 100 : 0,
      avgCostPerCall: totalCalls > 0 ? Math.round((totalCost / totalCalls) * 100) / 100 : 0,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get top destinations by cost and volume
router.get('/top-destinations', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year, startDate: startDateStr, endDate: endDateStr, limit = '5', carrierId: carrierIdParam } = req.query;
    const carrierId = carrierIdParam ? parseInt(carrierIdParam as string) : undefined;
    const rates = await prisma.rateMatrix.findMany();
    const limitNum = parseInt(limit as string);

    let dateFilter: any = {};
    // Prefer startDate/endDate if provided, otherwise fall back to month/year
    if (startDateStr && endDateStr) {
      const startDate = new Date(startDateStr as string);
      const endDate = new Date(endDateStr as string);
      endDate.setHours(23, 59, 59, 999);
      dateFilter = {
        callDate: {
          gte: startDate,
          lte: endDate,
        },
      };
    } else if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);
      dateFilter = {
        callDate: {
          gte: startDate,
          lte: endDate,
        },
      };
    }

    if (carrierId) {
      dateFilter.carrierId = carrierId;
    }

    const calls = await prisma.callRecord.findMany({
      where: dateFilter,
      select: {
        duration: true,
        originCountry: true,
        destCountry: true,
        callType: true,
        carrierId: true,
      },
    });

    // Aggregate by destination country
    const destStats: Record<string, { calls: number; cost: number; minutes: number }> = {};

    for (const call of calls) {
      const dest = call.destCountry || 'Unknown';
      if (!destStats[dest]) {
        destStats[dest] = { calls: 0, cost: 0, minutes: 0 };
      }

      const rate = await findRateForCall(rates, call.originCountry, call.destCountry, call.callType, call.carrierId);
      const callCost = (call.duration / 60) * rate;

      destStats[dest].calls += 1;
      destStats[dest].cost += callCost;
      destStats[dest].minutes += call.duration / 60;
    }

    // Convert to array and sort
    const destinations = Object.entries(destStats).map(([country, stats]) => ({
      country,
      calls: stats.calls,
      cost: Math.round(stats.cost * 100) / 100,
      minutes: Math.round(stats.minutes),
    }));

    // Get top by cost
    const topByCost = [...destinations]
      .sort((a, b) => b.cost - a.cost)
      .slice(0, limitNum);

    // Get top by volume
    const topByVolume = [...destinations]
      .sort((a, b) => b.calls - a.calls)
      .slice(0, limitNum);

    // For Option C, we need a combined view - sort by cost for the table
    const combined = [...destinations]
      .sort((a, b) => b.cost - a.cost)
      .slice(0, limitNum);

    res.json({
      topByCost,
      topByVolume,
      combined,
    });
  } catch (error) {
    console.error('Top destinations error:', error);
    res.status(500).json({ error: 'Failed to fetch top destinations' });
  }
});

// Get location stats (aggregated by origin country)
router.get('/locations', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year, carrierId: carrierIdParam } = req.query;
    const carrierId = carrierIdParam ? parseInt(carrierIdParam as string) : undefined;
    const rates = await prisma.rateMatrix.findMany();

    let dateFilter: any = {};
    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);
      dateFilter = {
        callDate: {
          gte: startDate,
          lte: endDate,
        },
      };
    }

    if (carrierId) {
      dateFilter.carrierId = carrierId;
    }

    const calls = await prisma.callRecord.findMany({
      where: dateFilter,
      select: {
        userEmail: true,
        duration: true,
        originCountry: true,
        destCountry: true,
        callType: true,
        carrierId: true,
      },
    });

    // Aggregate by origin country
    const locationStats: Record<string, {
      calls: number;
      cost: number;
      minutes: number;
      users: Set<string>;
    }> = {};

    for (const call of calls) {
      const origin = call.originCountry || 'Unknown';
      if (!locationStats[origin]) {
        locationStats[origin] = { calls: 0, cost: 0, minutes: 0, users: new Set() };
      }

      const rate = await findRateForCall(rates, call.originCountry, call.destCountry, call.callType, call.carrierId);
      const callCost = (call.duration / 60) * rate;

      locationStats[origin].calls += 1;
      locationStats[origin].cost += callCost;
      locationStats[origin].minutes += call.duration / 60;
      locationStats[origin].users.add(call.userEmail);
    }

    // Convert to array
    const locations = Object.entries(locationStats).map(([country, stats]) => ({
      country,
      countryCode: getCountryCode(country),
      calls: stats.calls,
      cost: Math.round(stats.cost * 100) / 100,
      minutes: Math.round(stats.minutes),
      users: stats.users.size,
    }));

    // Sort by cost descending
    locations.sort((a, b) => b.cost - a.cost);

    res.json(locations);
  } catch (error) {
    console.error('Location stats error:', error);
    res.status(500).json({ error: 'Failed to fetch location stats' });
  }
});

// Helper to get ISO country code for map
function getCountryCode(countryName: string): string {
  const countryCodeMap: Record<string, string> = {
    'USA': 'USA',
    'United States': 'USA',
    'United Kingdom': 'GBR',
    'UK': 'GBR',
    'Germany': 'DEU',
    'France': 'FRA',
    'Italy': 'ITA',
    'Spain': 'ESP',
    'Netherlands': 'NLD',
    'Belgium': 'BEL',
    'Switzerland': 'CHE',
    'Austria': 'AUT',
    'Sweden': 'SWE',
    'Norway': 'NOR',
    'Denmark': 'DNK',
    'Finland': 'FIN',
    'Ireland': 'IRL',
    'Portugal': 'PRT',
    'Poland': 'POL',
    'Czech Republic': 'CZE',
    'Hungary': 'HUN',
    'Romania': 'ROU',
    'Bulgaria': 'BGR',
    'Greece': 'GRC',
    'Turkey': 'TUR',
    'Russia': 'RUS',
    'Ukraine': 'UKR',
    'Canada': 'CAN',
    'Mexico': 'MEX',
    'Brazil': 'BRA',
    'Argentina': 'ARG',
    'Chile': 'CHL',
    'Colombia': 'COL',
    'Peru': 'PER',
    'Venezuela': 'VEN',
    'China': 'CHN',
    'Japan': 'JPN',
    'South Korea': 'KOR',
    'India': 'IND',
    'Australia': 'AUS',
    'New Zealand': 'NZL',
    'Singapore': 'SGP',
    'Hong Kong': 'HKG',
    'Taiwan': 'TWN',
    'Thailand': 'THA',
    'Malaysia': 'MYS',
    'Indonesia': 'IDN',
    'Philippines': 'PHL',
    'Vietnam': 'VNM',
    'Israel': 'ISR',
    'Saudi Arabia': 'SAU',
    'UAE': 'ARE',
    'United Arab Emirates': 'ARE',
    'South Africa': 'ZAF',
    'Egypt': 'EGY',
    'Nigeria': 'NGA',
    'Kenya': 'KEN',
    'Morocco': 'MAR',
  };
  return countryCodeMap[countryName] || '';
}

export default router;
