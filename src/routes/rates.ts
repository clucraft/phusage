import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Get all rates
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const rates = await prisma.rateMatrix.findMany({
      orderBy: { callType: 'asc' },
    });
    res.json(rates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

// Create or update a rate
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { callType, ratePerMinute, description } = req.body;

    const rate = await prisma.rateMatrix.upsert({
      where: { callType },
      update: { ratePerMinute, description },
      create: { callType, ratePerMinute, description },
    });

    res.json(rate);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save rate' });
  }
});

// Delete a rate
router.delete('/:callType', async (req: AuthRequest, res: Response) => {
  try {
    const { callType } = req.params;

    await prisma.rateMatrix.delete({
      where: { callType },
    });

    res.json({ message: 'Rate deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete rate' });
  }
});

// Bulk import rates
router.post('/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const { rates } = req.body;

    if (!Array.isArray(rates)) {
      res.status(400).json({ error: 'Rates must be an array' });
      return;
    }

    for (const rate of rates) {
      await prisma.rateMatrix.upsert({
        where: { callType: rate.callType },
        update: { ratePerMinute: rate.ratePerMinute, description: rate.description },
        create: { callType: rate.callType, ratePerMinute: rate.ratePerMinute, description: rate.description },
      });
    }

    res.json({ message: `${rates.length} rates imported successfully` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import rates' });
  }
});

export default router;
