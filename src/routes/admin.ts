import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Get all users
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create a new user (admin can add users even if registration is disabled)
router.post('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, name, role } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'user',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user role
router.patch('/users/:id/role', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { role } = req.body;

    if (!['admin', 'user'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    // Prevent removing the last admin
    if (role === 'user') {
      const adminCount = await prisma.user.count({ where: { role: 'admin' } });
      const currentUser = await prisma.user.findUnique({ where: { id } });
      if (adminCount === 1 && currentUser?.role === 'admin') {
        res.status(400).json({ error: 'Cannot remove the last admin' });
        return;
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Reset user password
router.patch('/users/:id/password', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { password } = req.body;

    if (!password || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Delete user
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    // Prevent deleting yourself
    if (req.user?.id === id) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    // Prevent deleting the last admin
    const user = await prisma.user.findUnique({ where: { id } });
    if (user?.role === 'admin') {
      const adminCount = await prisma.user.count({ where: { role: 'admin' } });
      if (adminCount === 1) {
        res.status(400).json({ error: 'Cannot delete the last admin' });
        return;
      }
    }

    await prisma.user.delete({ where: { id } });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get app settings
router.get('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.appSettings.findMany();
    const settingsMap: Record<string, string> = {};
    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });

    // Return defaults if not set
    res.json({
      allowRegistration: settingsMap.allowRegistration ?? 'true',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update app settings
router.patch('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const { allowRegistration } = req.body;

    if (typeof allowRegistration === 'boolean') {
      await prisma.appSettings.upsert({
        where: { key: 'allowRegistration' },
        update: { value: allowRegistration ? 'true' : 'false' },
        create: { key: 'allowRegistration', value: allowRegistration ? 'true' : 'false' },
      });
    }

    const settings = await prisma.appSettings.findMany();
    const settingsMap: Record<string, string> = {};
    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });

    res.json({
      allowRegistration: settingsMap.allowRegistration ?? 'true',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
