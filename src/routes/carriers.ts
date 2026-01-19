import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Get all carriers
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const carriers = await prisma.carrier.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(carriers);
  } catch (error) {
    console.error('Get carriers error:', error);
    res.status(500).json({ error: 'Failed to fetch carriers' });
  }
});

// Get carriers that have rates (for Teams upload dropdown)
router.get('/with-rates', async (req: AuthRequest, res: Response) => {
  try {
    const carriers = await prisma.carrier.findMany({
      where: {
        rateMatrices: {
          some: {},
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(carriers);
  } catch (error) {
    console.error('Get carriers with rates error:', error);
    res.status(500).json({ error: 'Failed to fetch carriers with rates' });
  }
});

export default router;
