import { Router, Response } from 'express';
import { createHash, generateKeyPairSync } from 'crypto';
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import prisma from '../utils/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { encrypt, decrypt } from '../utils/crypto';
import { sshManager } from '../services/SSHManager';
import { escapeShellArg } from '../utils/helpers';


const router = Router();
router.use(authMiddleware);

// Helper: derive SSH fingerprint from the public key string
function deriveFingerprint(publicKey: string): string {
  const parts = publicKey.trim().split(/\s+/);
  if (parts.length >= 2) {
    const buf = Buffer.from(parts[1], 'base64');
    const hash = createHash('md5').update(buf).digest('hex');
    return hash.match(/.{2}/g)!.join(':');
  }
  const hash = createHash('md5').update(publicKey).digest('hex');
  return hash.match(/.{2}/g)!.join(':');
}

// GET /api/keys — list all saved SSH keys for current user (private key never returned)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const keys = await prisma.sshKey.findMany({
      where: { userId: req.userId },
      select: { id: true, label: true, publicKey: true, fingerprint: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ keys });
  } catch (error) {
    console.error('[Keys] List error:', error);
    res.status(500).json({ error: 'Failed to list SSH keys' });
  }
});

// POST /api/keys — save a new SSH key
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { label, privateKey, publicKey } = req.body as {
      label: string;
      privateKey: string;
      publicKey?: string;
    };

    if (!label?.trim()) { res.status(400).json({ error: 'label is required' }); return; }
    if (!privateKey?.trim()) { res.status(400).json({ error: 'privateKey is required' }); return; }

    let resolvedPublicKey = publicKey?.trim() || '';
    if (!resolvedPublicKey) {
      try {
        const tmpDir = os.tmpdir();
        const keyFile = path.join(tmpDir, `likeVercel_tmp_${Date.now()}`);
        fs.writeFileSync(keyFile, privateKey.trim() + '\n', { mode: 0o600 });
        resolvedPublicKey = execSync(`ssh-keygen -y -f "${keyFile}"`, { encoding: 'utf-8' }).trim();
        try { fs.unlinkSync(keyFile); } catch {}
      } catch {
        res.status(400).json({ error: 'Could not derive public key — paste it manually or ensure the key is valid.' });
        return;
      }
    }

    const fingerprint = deriveFingerprint(resolvedPublicKey);
    const encrypted = encrypt(privateKey.trim());

    const key = await prisma.sshKey.create({
      data: {
        userId: req.userId,
        label: label.trim(),
        publicKey: resolvedPublicKey,
        fingerprint,
        encryptedPrivateKey: encrypted.data,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      },
    });

    res.status(201).json({
      key: {
        id: key.id,
        label: key.label,
        publicKey: key.publicKey,
        fingerprint: key.fingerprint,
        createdAt: key.createdAt,
      },
    });
  } catch (error) {
    console.error('[Keys] Save error:', error);
    res.status(500).json({ error: 'Failed to save SSH key' });
  }
});

// POST /api/keys/generate — generate a new Ed25519 key pair and save it
router.post('/generate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { label } = req.body as { label: string };
    if (!label?.trim()) { res.status(400).json({ error: 'label is required' }); return; }

    const tmpDir = os.tmpdir();
    const keyFile = path.join(tmpDir, `likeVercel_gen_${Date.now()}`);

    try {
      execSync(`ssh-keygen -t ed25519 -N "" -f "${keyFile}" -C "${label.trim()}"`);

      const privateKey = fs.readFileSync(keyFile, 'utf-8');
      const publicKey = fs.readFileSync(`${keyFile}.pub`, 'utf-8').trim();

      const fingerprint = deriveFingerprint(publicKey);
      const encrypted = encrypt(privateKey.trim());

      const key = await prisma.sshKey.create({
        data: {
          userId: req.userId,
          label: label.trim(),
          publicKey,
          fingerprint,
          encryptedPrivateKey: encrypted.data,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
        },
      });

      res.status(201).json({
        key: {
          id: key.id,
          label: key.label,
          publicKey: key.publicKey,
          fingerprint: key.fingerprint,
          createdAt: key.createdAt,
          lastUsedAt: key.lastUsedAt,
        },
        privateKey,
      });
    } finally {
      try { fs.unlinkSync(keyFile); } catch {}
      try { fs.unlinkSync(`${keyFile}.pub`); } catch {}
    }
  } catch (error: any) {
    console.error('[Keys] Generate error:', error);
    res.status(500).json({ error: `Key generation failed: ${error.message}` });
  }
});

// DELETE /api/keys/:id — delete a saved SSH key
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const key = await prisma.sshKey.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });
    if (!key) { res.status(404).json({ error: 'SSH key not found' }); return; }

    await prisma.sshKey.delete({ where: { id: key.id } });
    res.json({ message: 'SSH key deleted' });
  } catch (error) {
    console.error('[Keys] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete SSH key' });
  }
});

// POST /api/keys/:id/use — return decrypted private key to authenticated owner (for VPS form use)
router.post('/:id/use', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const key = await prisma.sshKey.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });
    if (!key) { res.status(404).json({ error: 'SSH key not found' }); return; }

    const privateKey = decrypt({ data: key.encryptedPrivateKey, iv: key.iv, authTag: key.authTag });
    res.json({ privateKey, publicKey: key.publicKey, label: key.label });
  } catch (error: any) {
    console.error('[Keys] Use error:', error);
    res.status(500).json({ error: 'Failed to retrieve key' });
  }
});

// POST /api/keys/:id/install — install saved public key onto a connected VPS
router.post('/:id/install', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { vpsId } = req.body as { vpsId: string };
    if (!vpsId?.trim()) { res.status(400).json({ error: 'vpsId is required' }); return; }

    const key = await prisma.sshKey.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });
    if (!key) { res.status(404).json({ error: 'SSH key not found' }); return; }

    const profile = await prisma.vpsProfile.findFirst({
      where: { id: vpsId.trim(), userId: req.userId },
    });
    if (!profile) { res.status(404).json({ error: 'VPS not found' }); return; }
    if (!sshManager.isConnected(profile.id)) { res.status(400).json({ error: 'VPS is not connected' }); return; }

    const publicKeyLine = key.publicKey.trim() + '\n';
    const sftp = await sshManager.getSftp(profile.id);
    
    try {
      // Ensure .ssh exists
      await new Promise<void>((resolve, reject) => {
        sftp.mkdir('.ssh', { mode: 0o700 }, (err) => {
          if (err && !err.message.toLowerCase().includes('failure')) {
            reject(new Error(`Failed to create .ssh directory: ${err.message}`));
          } else {
            resolve();
          }
        });
      });

      // Append to authorized_keys
      await new Promise((resolve, reject) => {
        const stream = sftp.createWriteStream('.ssh/authorized_keys', { 
          flags: 'a',
          mode: 0o600 
        });
        stream.on('error', reject);
        stream.on('close', resolve);
        stream.end(publicKeyLine);
      });
    } finally {
      sftp.end();
    }



    res.json({ message: 'Public key installed successfully' });
  } catch (error: any) {
    console.error('[Keys] Install error:', error);
    res.status(500).json({ error: `Key install failed: ${error.message}` });
  }
});

// Internal helper: get decrypted private key for a saved SSH key (used by VPS connect)
export async function getDecryptedPrivateKey(keyId: string, userId: string): Promise<string | null> {
  const key = await prisma.sshKey.findFirst({ where: { id: keyId, userId } });
  if (!key) return null;
  return decrypt({ data: key.encryptedPrivateKey, iv: key.iv, authTag: key.authTag });
}

export default router;
