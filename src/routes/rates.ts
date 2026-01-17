import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Get all rates with pagination and filtering
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { originCountry, destCountry, page = '1', limit = '100' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (originCountry) where.originCountry = originCountry;
    if (destCountry) where.destCountry = destCountry;

    const [rates, total] = await Promise.all([
      prisma.rateMatrix.findMany({
        where,
        orderBy: [{ originCountry: 'asc' }, { destination: 'asc' }],
        skip,
        take: limitNum,
      }),
      prisma.rateMatrix.count({ where }),
    ]);

    res.json({
      rates,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

// Get unique origin countries (for filters)
router.get('/origins', async (req: AuthRequest, res: Response) => {
  try {
    const origins = await prisma.rateMatrix.findMany({
      distinct: ['originCountry'],
      select: { originCountry: true },
      orderBy: { originCountry: 'asc' },
    });
    res.json(origins.map(o => o.originCountry));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch origin countries' });
  }
});

// Get unique destination countries (for filters)
router.get('/destinations', async (req: AuthRequest, res: Response) => {
  try {
    const { originCountry } = req.query;
    const where: any = {};
    if (originCountry) where.originCountry = originCountry;

    const destinations = await prisma.rateMatrix.findMany({
      where,
      distinct: ['destCountry'],
      select: { destCountry: true },
      orderBy: { destCountry: 'asc' },
    });
    res.json(destinations.map(d => d.destCountry));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch destination countries' });
  }
});

// Get rate statistics
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const [totalRates, originCount, destCount] = await Promise.all([
      prisma.rateMatrix.count(),
      prisma.rateMatrix.findMany({ distinct: ['originCountry'] }),
      prisma.rateMatrix.findMany({ distinct: ['destCountry'] }),
    ]);

    res.json({
      totalRates,
      originCountries: originCount.length,
      destinationCountries: destCount.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rate statistics' });
  }
});

// Create or update a rate manually
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { originCountry, destination, callType, pricePerMinute } = req.body;

    if (!originCountry || !destination || !pricePerMinute) {
      res.status(400).json({ error: 'originCountry, destination, and pricePerMinute are required' });
      return;
    }

    const destCountry = destination.split('-')[0].trim();

    const rate = await prisma.rateMatrix.upsert({
      where: {
        originCountry_destination_callType: {
          originCountry,
          destination,
          callType: callType || 'Outbound',
        },
      },
      update: { pricePerMinute, destCountry },
      create: {
        originCountry,
        destination,
        destCountry,
        callType: callType || 'Outbound',
        pricePerMinute,
      },
    });

    res.json(rate);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save rate' });
  }
});

// Delete a rate
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    await prisma.rateMatrix.delete({
      where: { id },
    });

    res.json({ message: 'Rate deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete rate' });
  }
});

// Clear all rates
router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.rateMatrix.deleteMany({});
    res.json({ message: `Deleted ${result.count} rates` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear rates' });
  }
});

// Lookup rate for a specific origin/destination pair
router.get('/lookup', async (req: AuthRequest, res: Response) => {
  try {
    const { originCountry, destCountry, callType = 'Outbound' } = req.query;

    if (!originCountry || !destCountry) {
      res.status(400).json({ error: 'originCountry and destCountry are required' });
      return;
    }

    // Try exact destination match first, then fall back to base country
    let rate = await prisma.rateMatrix.findFirst({
      where: {
        originCountry: originCountry as string,
        destCountry: destCountry as string,
        callType: callType as string,
      },
      orderBy: { destination: 'asc' }, // Prefer shorter/simpler matches
    });

    if (!rate) {
      // Try just the base destination country
      rate = await prisma.rateMatrix.findFirst({
        where: {
          originCountry: originCountry as string,
          destination: destCountry as string,
          callType: callType as string,
        },
      });
    }

    if (!rate) {
      res.status(404).json({ error: 'No rate found for this route' });
      return;
    }

    res.json(rate);
  } catch (error) {
    res.status(500).json({ error: 'Failed to lookup rate' });
  }
});

export default router;
