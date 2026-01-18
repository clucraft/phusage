import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Helper to get setting value
async function getSetting(key: string, defaultValue: string): Promise<string> {
  const setting = await prisma.appSettings.findUnique({ where: { key } });
  return setting?.value ?? defaultValue;
}

// Check if registration is enabled
router.get('/registration-status', async (req: Request, res: Response) => {
  try {
    const userCount = await prisma.user.count();
    // Always allow if no users exist (first user setup)
    if (userCount === 0) {
      res.json({ enabled: true, firstUser: true });
      return;
    }
    const enabled = await getSetting('allowRegistration', 'true');
    res.json({ enabled: enabled === 'true', firstUser: false });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check registration status' });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Check if this is the first user
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;

    // If not first user, check if registration is enabled
    if (!isFirstUser) {
      const allowRegistration = await getSetting('allowRegistration', 'true');
      if (allowRegistration !== 'true') {
        res.status(403).json({ error: 'Registration is disabled' });
        return;
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // First user becomes admin
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: isFirstUser ? 'admin' : 'user',
      },
    });

    // If first user, initialize settings
    if (isFirstUser) {
      await prisma.appSettings.upsert({
        where: { key: 'allowRegistration' },
        update: { value: 'true' },
        create: { key: 'allowRegistration', value: 'true' },
      });
    }

    res.status(201).json({
      message: isFirstUser ? 'Admin account created successfully' : 'User created successfully',
      userId: user.id,
      isAdmin: isFirstUser,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      secret,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to login' });
  }
});

export default router;
