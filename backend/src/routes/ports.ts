import { Router, Response } from 'express';
import prisma from '../utils/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sshManager } from '../services/SSHManager';
import { verifyVps } from '../utils/helpers';

interface ManagedPortData {
  port: number | null;
  processName: string;
  projectPath: string;
}

const router = Router();

router.use(authMiddleware);

// GET /api/vps/:id/ports — list used ports
router.get('/:id/ports', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    // Get listening ports from the server
    const output = await sshManager.executeCommand(
      vpsId,
      "ss -tlnp 2>/dev/null | tail -n +2 | awk '{print $4}' | rev | cut -d: -f1 | rev | sort -un"
    );

    const activePorts = output
      .split('\n')
      .filter(Boolean)
      .map((p) => parseInt(p.trim()))
      .filter((p) => !isNaN(p));

    // Get ports from our deployments
    const deployments = await prisma.deployment.findMany({
      where: { vpsId, status: 'running' },
      select: { port: true, processName: true, projectPath: true },
    });

    // Get the VPS host for shareable URLs
    const vps = await prisma.vpsProfile.findUnique({
      where: { id: vpsId },
      select: { host: true },
    });

    res.json({
      activePorts,
      managedPorts: deployments.map((d: ManagedPortData) => ({
        port: d.port,
        processName: d.processName,
        projectPath: d.projectPath,
        url: `http://${vps?.host}:${d.port}`,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/vps/:id/ports/check — check if a port is available
router.post('/:id/ports/check', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    const { port } = req.body;
    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      res.status(400).json({ error: 'Invalid port number' });
      return;
    }

    try {
      const output = await sshManager.executeCommand(
        vpsId,
        `ss -tlnp 'sport = :${portNum}' | grep -c LISTEN || echo 0`
      );
      const isUsed = parseInt(output.trim()) > 0;

      res.json({
        port: portNum,
        available: !isUsed,
        message: isUsed ? `Port ${portNum} is in use` : `Port ${portNum} is available`,
      });
    } catch {
      res.json({ port: portNum, available: true, message: `Port ${portNum} appears available` });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/vps/:id/ports/share/:port — generate shareable URL
router.get('/:id/ports/share/:port', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    const profile = await prisma.vpsProfile.findUnique({
      where: { id: vpsId },
      select: { host: true },
    });

    const port = parseInt(req.params.port as string);
    if (isNaN(port) || port < 1 || port > 65535) {
      res.status(400).json({ error: 'Invalid port number' });
      return;
    }

    const url = `http://${profile?.host}:${port}`;

    res.json({
      url,
      port,
      host: profile?.host,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
