import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import prisma from '../utils/prisma';
import { config } from '../config';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { registerSchema, loginSchema } from '../utils/validators';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

const router = Router();
const SALT_ROUNDS = 12;

function generateTokens(userId: string) {
  const { secret, refreshSecret, expiresIn, refreshExpiresIn } = config.jwt;
  const accessToken = jwt.sign({ userId }, secret, { expiresIn } as jwt.SignOptions);
  const refreshToken = jwt.sign({ userId }, refreshSecret, { expiresIn: refreshExpiresIn } as jwt.SignOptions);
  return { accessToken, refreshToken };
}


// POST /api/auth/register
router.post('/register', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = registerSchema.parse(req.body);

    const userCount = await prisma.user.count();
    const role = userCount === 0 ? 'ADMIN' : 'USER';
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      res.status(400).json({ error: 'User with this email already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Create user in local DB
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: role,
      },
    });


    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('[Auth] Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const validPassword = await bcrypt.compare(data.password, user.password);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(user.id);

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as { userId: string };

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const { accessToken } = generateTokens(user.id);

    res.json({ accessToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name },
      select: { id: true, email: true, name: true, role: true }
    });

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// PUT /api/auth/password
router.put('/password', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Both current and new passwords are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// DELETE /api/auth/profile
router.delete('/profile', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userId = req.userId;
    const vpsProfiles = await prisma.vpsProfile.findMany({ where: { userId } });
    for (const profile of vpsProfiles) {
      await prisma.deployment.deleteMany({ where: { vpsId: profile.id } });
    }
    await prisma.vpsProfile.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    res.json({ message: 'User profile and all associated data deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

// POST /api/auth/restore — upload a backup SQLite file to replace dev.db
router.post('/restore', authMiddleware, adminMiddleware, upload.single('backup'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ error: 'No backup file uploaded' });
      return;
    }

    // Validate SQLite3 magic bytes: "SQLite format 3\0"
    const SQLITE_MAGIC = Buffer.from([0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00]);
    if (file.buffer.length < 16 || !file.buffer.slice(0, 16).equals(SQLITE_MAGIC)) {
      res.status(400).json({ error: 'File does not appear to be a valid SQLite 3 database' });
      return;
    }

    const dbPath = path.resolve(__dirname, '../../prisma/dev.db');
    const backupPath = `${dbPath}.pre-restore-${Date.now()}`;

    // Keep a safety copy of the current db, then replace
    if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, backupPath);
    try {
      await prisma.$disconnect();
      fs.writeFileSync(dbPath, file.buffer);
      // Reconnect by accessing prisma lazily (it reconnects on next query)
      await prisma.$connect();
      // Clean up safety backup on success
      try { if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath); } catch {}
    } catch (writeErr) {
      // Try to roll back
      if (fs.existsSync(backupPath)) {
        try { fs.copyFileSync(backupPath, dbPath); await prisma.$connect(); } catch {}
      }
      throw writeErr;
    }

    res.json({ message: 'Database restored successfully. Please reload the app.' });
  } catch (error: any) {
    console.error('[Auth] Restore error:', error);
    res.status(500).json({ error: `Restore failed: ${error.message}` });
  }
});

// GET /api/auth/backup — stream a copy of the SQLite database
router.get('/backup', authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Prisma stores the db relative to the schema file (prisma/dev.db)
    const dbPath = path.resolve(__dirname, '../../prisma/dev.db');
    if (!fs.existsSync(dbPath)) {
      res.status(404).json({ error: 'Database file not found' });
      return;
    }
    const filename = `likeVercel-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    fs.createReadStream(dbPath).pipe(res);
  } catch (error) {
    console.error('[Auth] Backup error:', error);
    res.status(500).json({ error: 'Failed to download backup' });
  }
});

// GET /api/auth/activity — return recent activity log for the user
router.get('/activity', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const logs = await prisma.activityLog.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, action: true, details: true, createdAt: true },
    });
    res.json({ logs });
  } catch (error) {
    console.error('[Auth] Activity fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

export default router;
