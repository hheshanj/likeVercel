import { Router, Response } from 'express';
import prisma from '../utils/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { encrypt } from '../utils/crypto';
import { sshManager } from '../services/SSHManager';
import { createVpsSchema, updateVpsSchema } from '../utils/validators';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/vps — list all VPS profiles for current user
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized: User not found' });
      return;
    }

    const profiles = await prisma.vpsProfile.findMany({
      where: { userId: req.userId },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        username: true,
        authType: true,
        region: true,
        lastConnectedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Attach live connection status
    const profilesWithStatus = profiles.map((p: any) => ({
      ...p,
      isConnected: sshManager.isConnected(p.id),
    }));

    res.json({ profiles: profilesWithStatus });
  } catch (error) {
    console.error('[VPS] List error:', error);
    res.status(500).json({ error: 'Failed to list VPS profiles' });
  }
});

// GET /api/vps/:id — get single VPS profile
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const profile = await prisma.vpsProfile.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        username: true,
        authType: true,
        region: true,
        lastConnectedAt: true,
        createdAt: true,
        deployments: {
          select: {
            id: true,
            projectPath: true,
            processName: true,
            port: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!profile) {
      res.status(404).json({ error: 'VPS profile not found' });
      return;
    }

    res.json({
      profile: {
        ...profile,
        isConnected: sshManager.isConnected(profile.id),
      },
    });
  } catch (error) {
    console.error('[VPS] Get error:', error);
    res.status(500).json({ error: 'Failed to get VPS profile' });
  }
});

// POST /api/vps — create new VPS profile
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const data = createVpsSchema.parse(req.body);

    // Build credentials object
    const credentials: Record<string, any> = {
      host: data.host,
      port: data.port,
      username: data.username,
    };
    if (data.authType === 'password') {
      credentials.password = data.password;
    } else {
      credentials.privateKey = data.privateKey;
      if (data.passphrase) {
        credentials.passphrase = data.passphrase;
      }
    }

    // Encrypt credentials
    const encrypted = encrypt(JSON.stringify(credentials));

    const profile = await prisma.vpsProfile.create({
      data: {
        userId: req.userId,
        name: data.name,
        host: data.host,
        port: data.port,
        username: data.username,
        authType: data.authType,
        encryptedCredentials: encrypted.data,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      },
    });

    res.status(201).json({
      profile: {
        id: profile.id,
        name: profile.name,
        host: profile.host,
        port: profile.port,
        username: profile.username,
        authType: profile.authType,
        isConnected: false,
        createdAt: profile.createdAt,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('[VPS] Create error:', error);
    res.status(500).json({ error: 'Failed to create VPS profile' });
  }
});

// PUT /api/vps/:id — update VPS profile
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const data = updateVpsSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.vpsProfile.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'VPS profile not found' });
      return;
    }

    // If credentials changed, re-encrypt
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.host) updateData.host = data.host;
    if (data.port) updateData.port = data.port;
    if (data.username) updateData.username = data.username;
    if (data.authType) updateData.authType = data.authType;

    if (data.password || data.privateKey) {
      const credentials: Record<string, any> = {
        host: data.host || existing.host,
        port: data.port || existing.port,
        username: data.username || existing.username,
      };
      const effectiveAuthType = data.authType || existing.authType;
      if (effectiveAuthType === 'password') {
        if (!data.password) {
          res.status(400).json({ error: 'Password is required when authType is password' });
          return;
        }
        credentials.password = data.password;
      } else {
        if (!data.privateKey) {
          res.status(400).json({ error: 'Private key is required when authType is privateKey' });
          return;
        }
        credentials.privateKey = data.privateKey;
        if (data.passphrase) {
          credentials.passphrase = data.passphrase;
        }
      }

      const encrypted = encrypt(JSON.stringify(credentials));
      updateData.encryptedCredentials = encrypted.data;
      updateData.iv = encrypted.iv;
      updateData.authTag = encrypted.authTag;
    }

    const profile = await prisma.vpsProfile.update({
      where: { id: req.params.id as string },
      data: updateData,
    });

    res.json({
      profile: {
        id: profile.id,
        name: profile.name,
        host: profile.host,
        port: profile.port,
        username: profile.username,
        authType: profile.authType,
        isConnected: sshManager.isConnected(profile.id),
        createdAt: profile.createdAt,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('[VPS] Update error:', error);
    res.status(500).json({ error: 'Failed to update VPS profile' });
  }
});

// DELETE /api/vps/:id — delete VPS profile
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const existing = await prisma.vpsProfile.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'VPS profile not found' });
      return;
    }

    // Disconnect if connected
    if (sshManager.isConnected(existing.id)) {
      await sshManager.disconnect(existing.id);
    }

    await prisma.vpsProfile.delete({ where: { id: existing.id } });
    res.json({ message: 'VPS profile deleted' });
  } catch (error) {
    console.error('[VPS] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete VPS profile' });
  }
});

// POST /api/vps/:id/connect — establish SSH connection
router.post('/:id/connect', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const profile = await prisma.vpsProfile.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });

    if (!profile) {
      res.status(404).json({ error: 'VPS profile not found' });
      return;
    }

    if (sshManager.isConnected(profile.id)) {
      res.json({ message: 'Already connected', isConnected: true });
      return;
    }

    await sshManager.connect(
      profile.id,
      profile.encryptedCredentials,
      profile.iv,
      profile.authTag
    );

    // Update last connected timestamp and region if missing
    const updateData: any = { lastConnectedAt: new Date() };
    if (!(profile as any).region) {
      try {
        const loc = await sshManager.executeCommand(profile.id, "curl -s http://ip-api.com/line?fields=city,countryCode | tr '\\n' ',' | sed 's/,$//'");
        if (loc.trim()) updateData.region = loc.trim().toUpperCase();
      } catch (err) {
        console.error('[VPS] Get region failed on connect:', err);
      }
    }

    await prisma.vpsProfile.update({
      where: { id: profile.id },
      data: updateData,
    });

    res.json({ message: 'Connected successfully', isConnected: true });
  } catch (error: any) {
    console.error('[VPS] Connect error:', error);
    res.status(500).json({ error: `Connection failed: ${error.message}` });
  }
});

// POST /api/vps/:id/disconnect — close SSH connection
router.post('/:id/disconnect', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const profile = await prisma.vpsProfile.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });

    if (!profile) {
      res.status(404).json({ error: 'VPS profile not found' });
      return;
    }

    await sshManager.disconnect(profile.id);
    res.json({ message: 'Disconnected', isConnected: false });
  } catch (error) {
    console.error('[VPS] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// GET /api/vps/:id/specs — get dynamic server hardware specs
router.get('/:id/specs', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const profile = await prisma.vpsProfile.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });

    if (!profile) {
      res.status(404).json({ error: 'VPS profile not found' });
      return;
    }

    if (!sshManager.isConnected(profile.id)) {
      res.status(400).json({ error: 'VPS is not connected' });
      return;
    }

    try {
      const osVersion = await sshManager.executeCommand(profile.id, "cat /etc/os-release | grep PRETTY_NAME | cut -d '=' -f 2 | tr -d '\"'");
      const cpuStr = await sshManager.executeCommand(profile.id, "nproc");
      const cpuCores = parseInt(cpuStr, 10) || 'Unknown';
      const ramStr = await sshManager.executeCommand(profile.id, "free -h | awk '/^Mem:/{print $2}'");
      const diskStr = await sshManager.executeCommand(profile.id, "df -h / | awk 'NR==2 {print $2}'");
      
      res.json({
        os: osVersion.trim(),
        cpu: `${cpuCores} Cores`,
        ram: ramStr.trim(),
        disk: diskStr.trim(),
        region: (profile as any).region || 'Unknown'
      });
    } catch (cmdErr: any) {
      console.error('[VPS] Specs cmd error:', cmdErr);
      res.status(500).json({ error: 'Failed to execute spec commands on VPS' });
    }
  } catch (error) {
    console.error('[VPS] Get specs error:', error);
    res.status(500).json({ error: 'Failed to fetch specs' });
  }
});

// GET /api/vps/:id/status — get connection status
router.get('/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const profile = await prisma.vpsProfile.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });

    if (!profile) {
      res.status(404).json({ error: 'VPS profile not found' });
      return;
    }

    res.json({ isConnected: sshManager.isConnected(profile.id) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// GET /api/vps/:id/usage — live CPU% and RAM% via procfs
router.get('/:id/usage', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const profile = await prisma.vpsProfile.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });
    if (!profile) { res.status(404).json({ error: 'VPS not found' }); return; }
    if (!sshManager.isConnected(profile.id)) { res.status(400).json({ error: 'Not connected' }); return; }

    // Two /proc/stat samples, 500ms apart for accurate CPU delta
    const stat1 = await sshManager.executeCommand(profile.id, "cat /proc/stat | head -1");
    await new Promise(r => setTimeout(r, 500));
    const stat2 = await sshManager.executeCommand(profile.id, "cat /proc/stat | head -1");

    const parse = (line: string) => line.split(/\s+/).slice(1).map(Number);
    const s1 = parse(stat1), s2 = parse(stat2);
    const idle1 = s1[3], idle2 = s2[3];
    const total1 = s1.reduce((a, b) => a + b, 0), total2 = s2.reduce((a, b) => a + b, 0);
    const cpuPercent = Math.round((1 - (idle2 - idle1) / (total2 - total1)) * 100);

    const memStr = await sshManager.executeCommand(profile.id, "free | grep Mem | awk '{print $2,$3}'");
    const [totalMem, usedMem] = memStr.split(' ').map(Number);
    const ramPercent = Math.round((usedMem / totalMem) * 100);

    res.json({ cpu: cpuPercent, ram: ramPercent });
  } catch (error) {
    console.error('[VPS] Usage error:', error);
    res.status(500).json({ error: 'Failed to get usage stats' });
  }
});

// POST /api/vps/keys/generate — generate an Ed25519 SSH keypair server-side
router.post('/keys/generate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { generateKeyPairSync } = await import('crypto');
    const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });

    // Build OpenSSH public key line from spki PEM
    const { execSync } = await import('child_process');
    const os = await import('os');
    const path = await import('path');
    const fs = await import('fs');

    const tmpDir = os.default.tmpdir();
    const keyFile = path.default.join(tmpDir, `likeVercel_${Date.now()}`);

    fs.default.writeFileSync(keyFile, privateKey, { mode: 0o600 });

    let sshPublicKey = '';
    try {
      sshPublicKey = execSync(`ssh-keygen -y -f "${keyFile}"`, { encoding: 'utf-8' }).trim();
      sshPublicKey += ` likeVercel-generated`;
    } catch {
      // fallback: return raw spki PEM if ssh-keygen not available
      sshPublicKey = publicKey;
    } finally {
      try { fs.default.unlinkSync(keyFile); } catch {}
    }

    res.json({ privateKey, publicKey: sshPublicKey });
  } catch (error: any) {
    console.error('[Keys] Generate error:', error);
    res.status(500).json({ error: `Key generation failed: ${error.message}` });
  }
});

// POST /api/vps/:id/keys/install — install a public key on a connected VPS
router.post('/:id/keys/install', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { publicKey } = req.body as { publicKey: string };
    if (!publicKey || !publicKey.trim()) {
      res.status(400).json({ error: 'publicKey is required' });
      return;
    }

    const profile = await prisma.vpsProfile.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });
    if (!profile) { res.status(404).json({ error: 'VPS not found' }); return; }
    if (!sshManager.isConnected(profile.id)) { res.status(400).json({ error: 'VPS is not connected' }); return; }

    const safeKey = publicKey.trim().replace(/'/g, "'\\''");
    await sshManager.executeCommand(
      profile.id,
      `mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '${safeKey}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`
    );

    res.json({ message: 'Public key installed successfully' });
  } catch (error: any) {
    console.error('[Keys] Install error:', error);
    res.status(500).json({ error: `Key install failed: ${error.message}` });
  }
});

export default router;
