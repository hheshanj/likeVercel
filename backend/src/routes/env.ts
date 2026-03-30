import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sshManager } from '../services/SSHManager';
import { verifyVps, escapeShellArg } from '../utils/helpers';
import path from 'path';

const router = Router();
router.use(authMiddleware);

/**
 * Parses a raw .env file string into a key-value record.
 * Handles comments (#), blank lines, and values with '=' signs.
 */
function parseEnvFile(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }
  return result;
}

/**
 * Serializes a key-value record back to a .env file string.
 */
function serializeEnvFile(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => {
      // Quote values that contain spaces or special chars
      const needsQuoting = /[\s"'#$\\]/.test(v);
      const serializedValue = needsQuoting ? `"${v.replace(/"/g, '\\"')}"` : v;
      return `${k}=${serializedValue}`;
    })
    .join('\n') + '\n';
}

// GET /api/vps/:id/env?path=/var/www/myapp
// Reads the .env file at the given project path and returns key-value pairs.
router.get('/:id/env', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    const projectPath = req.query.path as string;
    if (!projectPath) {
      res.status(400).json({ error: 'path query parameter is required' });
      return;
    }

    const envFilePath = path.posix.join(projectPath, '.env');
    const escapedPath = escapeShellArg(envFilePath);

    let raw = '';
    try {
      raw = await sshManager.executeCommand(vpsId, `cat ${escapedPath} 2>/dev/null || echo ""`);
    } catch {
      // File may not exist — return empty
    }

    res.json({ env: parseEnvFile(raw) });
  } catch (error: any) {
    console.error('[Env] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/vps/:id/env?path=/var/www/myapp
// Receives key-value pairs and writes them to the .env file.
router.put('/:id/env', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    const projectPath = req.query.path as string;
    if (!projectPath) {
      res.status(400).json({ error: 'path query parameter is required' });
      return;
    }

    const { env } = req.body as { env: Record<string, string> };
    if (typeof env !== 'object' || env === null || Array.isArray(env)) {
      res.status(400).json({ error: 'env must be a key-value object' });
      return;
    }

    // Sanitize keys — only allow valid env var names
    for (const key of Object.keys(env)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        res.status(400).json({ error: `Invalid environment variable name: "${key}". Keys must match [A-Za-z_][A-Za-z0-9_]*` });
        return;
      }
    }

    const envFilePath = path.posix.join(projectPath, '.env');
    const content = serializeEnvFile(env);

    // Write file using printf to avoid echo interpretation of escape sequences
    const escapedContent = content.replace(/'/g, "'\\''");
    const escapedPath = escapeShellArg(envFilePath);
    await sshManager.executeCommand(vpsId, `printf '%s' '${escapedContent}' > ${escapedPath}`);

    res.json({ message: '.env file updated', path: envFilePath, count: Object.keys(env).length });
  } catch (error: any) {
    console.error('[Env] PUT error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
