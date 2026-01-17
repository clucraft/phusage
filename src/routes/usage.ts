import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

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

    // Get rates for cost calculation
    const rates = await prisma.rateMatrix.findMany();
    const rateMap = new Map(rates.map(r => [r.callType, r.ratePerMinute]));

    // Calculate costs
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
          },
        });

        const totalCost = userCalls.reduce((sum, call) => {
          const rate = rateMap.get(call.callType) || rateMap.get('default') || 0;
          return sum + (call.duration / 60) * Number(rate);
        }, 0);

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
    const rateMap = new Map(rates.map(r => [r.callType, r.ratePerMinute]));

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
          },
        });

        const totalCost = userCalls.reduce((sum, call) => {
          const rate = rateMap.get(call.callType) || rateMap.get('default') || 0;
          return sum + (call.duration / 60) * Number(rate);
        }, 0);

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
    const rateMap = new Map(rates.map(r => [r.callType, r.ratePerMinute]));

    const totalDuration = userCalls.reduce((sum, call) => sum + call.duration, 0);
    const totalCost = userCalls.reduce((sum, call) => {
      const rate = rateMap.get(call.callType) || rateMap.get('default') || 0;
      return sum + (call.duration / 60) * Number(rate);
    }, 0);

    res.json({
      userName: userCalls[0].userName,
      userEmail: userCalls[0].userEmail,
      totalMinutes: Math.round(totalDuration / 60),
      totalCalls: userCalls.length,
      totalCost: Math.round(totalCost * 100) / 100,
      calls: userCalls.map(call => ({
        date: call.callDate,
        duration: call.duration,
        type: call.callType,
        destination: call.destination,
        cost: Math.round((call.duration / 60) * Number(rateMap.get(call.callType) || rateMap.get('default') || 0) * 100) / 100,
      })),
    });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

export default router;
