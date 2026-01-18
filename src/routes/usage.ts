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
  callType: string
): Promise<number> {
  if (!originCountry || !destCountry) return 0;

  // Try to find exact match for origin + destCountry + callType
  let rate = rates.find(
    r => r.originCountry === originCountry &&
         r.destCountry === destCountry &&
         r.callType === callType
  );

  // If no exact match, try matching by destination field (for specific destinations like "Afghanistan-Mobile")
  if (!rate) {
    rate = rates.find(
      r => r.originCountry === originCountry &&
           r.destination === destCountry &&
           r.callType === callType
    );
  }

  // Fall back to any rate with matching origin and destCountry (ignore callType)
  if (!rate) {
    rate = rates.find(
      r => r.originCountry === originCountry &&
           r.destCountry === destCountry
    );
  }

  return rate ? Number(rate.pricePerMinute) : 0;
}

// Get usage summary for all users (with optional month filter)
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query;

    let dateFilter = {};
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
          },
        });

        let totalCost = 0;
        for (const call of userCalls) {
          const rate = await findRateForCall(rates, call.originCountry, call.destCountry, call.callType);
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
    const { month, year } = req.query;

    let dateFilter = {};
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
          },
        });

        let totalCost = 0;
        for (const call of userCalls) {
          const rate = await findRateForCall(rates, call.originCountry, call.destCountry, call.callType);
          totalCost += (call.duration / 60) * rate;
        }

        return {
          userEmail: user.userEmail,
          userName: user.userName,
          totalMinutes: Math.round((user._sum.duration || 0) / 60),
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
    const { month, year } = req.query;

    let dateFilter = {};
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
      const rate = await findRateForCall(rates, call.originCountry, call.destCountry, call.callType);
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

export default router;
