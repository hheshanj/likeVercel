import { Router, Response } from 'express';
import prisma from '../utils/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sshManager } from '../services/SSHManager';
import { processStartSchema } from '../utils/validators';
import { verifyVps, escapeShellArg, splitShellTokens } from '../utils/helpers';

const router = Router();

router.use(authMiddleware);

// GET /api/vps/:id/processes — list managed processes
router.get('/:id/processes', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    const deployments = await prisma.deployment.findMany({
      where: { vpsId },
      orderBy: { createdAt: 'desc' },
    });

    // Get the VPS host for shareable URLs
    const vps = await prisma.vpsProfile.findUnique({
      where: { id: vpsId },
      select: { host: true },
    });

    // Check actual PM2 process status
    let pm2Processes: any[] = [];
    try {
      const pm2Output = await sshManager.executeCommand(vpsId, 'pm2 list --format json 2>/dev/null || pm2 jlist 2>/dev/null || echo "[]"');
      pm2Processes = JSON.parse(pm2Output);
    } catch {
      // PM2 not available or output not parseable, pm2Processes stays empty
    }

    const unmanagedPm2Processes = pm2Processes.filter(
      (p: any) => !deployments.find((d) => d.processName === p.name)
    ).map((p: any) => ({
      processName: p.name,
      cpu: p.monit?.cpu || 0,
      memory: p.monit?.memory || 0,
      status: p.pm2_env?.status || 'unknown',
      pm_id: p.pm_id,
      type: 'pm2'
    }));

    // Scan for all listening TCP ports
    const listeningPorts = new Set<number>();
    const unmanagedPorts: any[] = [];
    
    try {
      let ssOutput = '';
      try {
        ssOutput = await sshManager.executeCommand(vpsId, "ss -lntp | grep 'LISTEN'");
      } catch {
        ssOutput = await sshManager.executeCommand(vpsId, "lsof -iTCP -sTCP:LISTEN -P -n | grep 'LISTEN'");
      }

      const lines = ssOutput.split('\n').filter(l => l.trim());
      const managedPorts = new Set(deployments.map(d => d.port));
      const pm2Ports = new Set();
      pm2Processes.forEach(p => {
        if (p.pm2_env?.PORT) pm2Ports.add(parseInt(p.pm2_env.PORT));
      });

      for (const line of lines) {
        let port: number | null = null;
        let name = 'raw-process';
        let pid: string | null = null;

        if (line.includes('users:')) {
          const portMatch = line.match(/:(\d+)\s+/);
          if (portMatch) port = parseInt(portMatch[1]);
          const userMatch = line.match(/users:\(\("([^"]+)",pid=(\d+)/);
          if (userMatch) { name = userMatch[1]; pid = userMatch[2]; }
        } else {
          const parts = line.split(/\s+/).filter(Boolean);
          const addrPart = parts.find(p => p.includes(':') || p.includes('*'));
          if (addrPart) {
            const portStr = addrPart.split(':').pop() || addrPart.split('*').pop();
            if (portStr) port = parseInt(portStr);
          }
          
          // Try to find PID in ss output (format: users:(("node",pid=1234,fd=18)))
          const pidMatch = line.match(/pid=(\d+)/);
          if (pidMatch) pid = pidMatch[1];
        }
        
        if (port && !isNaN(port)) {
          listeningPorts.add(port);
          
          if (!managedPorts.has(port) && !pm2Ports.has(port)) {
            if (![22, 25, 53, 111, 2049].includes(port)) {
              unmanagedPorts.push({
                processName: `${name}:${port}`,
                cpu: 0,
                memory: 0,
                status: 'running',
                port: port,
                pid: pid,
                type: 'port'
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Process] Robust port scan failed:', err);
    }

    const allUnmanaged = [...unmanagedPm2Processes, ...unmanagedPorts];

    const processesWithStatus = deployments.map((d: any) => {
      const pm2Process = pm2Processes.find((p: any) => p.name === d.processName);
      
      // Status determination:
      // 1. If in PM2, use PM2 status
      // 2. If not in PM2 but port is listening, it is "online" (raw process)
      // 3. Otherwise, it is "stopped"
      let status = 'stopped';
      if (pm2Process) {
        status = pm2Process.pm2_env.status;
      } else if (d.port && listeningPorts.has(d.port)) {
        status = 'online';
      }

      return {
        ...d,
        actualStatus: status,
        cpu: pm2Process?.monit?.cpu || 0,
        memory: pm2Process?.monit?.memory || 0,
        url: `http://${vps?.host}:${d.port}`,
      };
    });

    res.json({ processes: processesWithStatus, unmanagedProcesses: allUnmanaged });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



// POST /api/vps/:id/processes/start — detect project & start process
router.post('/:id/processes/start', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    const data = processStartSchema.parse(req.body);
    const projectPath = data.projectPath; // Already validated for .. and absolute path
    const port = data.port || Math.floor(3000 + Math.random() * 6000);

    const escapedPath = escapeShellArg(projectPath);

    // Detect project type using a more robust way (Fix 14)
    // We'll check for files using find or ls with specific flags
    let files: string;
    try {
      // Fix 2: Use escaped path
      files = await sshManager.executeCommand(vpsId, `ls -F ${escapedPath}`);
    } catch {
      res.status(400).json({ error: 'Project path not found on server' });
      return;
    }

    let startCommand: string;
    let processName: string;
    let projectType: string;

    const fileList = files.split('\n').map(f => f.trim());

    if (data.command) {
      // Custom command — escape each part of the command safely
      processName = data.processName || `custom-${port}`;
      const tokens = splitShellTokens(data.command);
      if (tokens.length === 0) {
        res.status(400).json({ error: 'Command cannot be empty' });
        return;
      }
      
      const escapedScript = escapeShellArg(tokens[0]);
      const escapedArgs = tokens.slice(1).map(arg => escapeShellArg(arg)).join(' ');
      const escapedProcessName = escapeShellArg(processName);
      
      // Use -- to separate pm2 options from the user command/arguments
      startCommand = `cd ${escapedPath} && pm2 start ${escapedScript} --name ${escapedProcessName} ${escapedArgs ? '-- ' + escapedArgs : ''}`;
      projectType = 'custom';
    } else if (fileList.includes('package.json')) {
      processName = data.processName || `node-${port}`;
      const escapedProcessName = escapeShellArg(processName);
      startCommand = `cd ${escapedPath} && npm install && PORT=${port} pm2 start npm --name ${escapedProcessName} -- start`;
      projectType = 'node';
    } else if (fileList.includes('requirements.txt')) {
      processName = data.processName || `python-${port}`;
      const escapedProcessName = escapeShellArg(processName);
      // Detect the main Python file instead of assuming app.py
      const mainFile = fileList.find(f => f.endsWith('.py') && !f.startsWith('.')) || 'app.py';
      const escapedMainFile = escapeShellArg(mainFile);
      startCommand = `cd ${escapedPath} && pip install -r requirements.txt && pm2 start ${escapedMainFile} --name ${escapedProcessName}`;
      projectType = 'python';
    } else if (fileList.includes('index.html')) {
      processName = data.processName || `static-${port}`;
      const escapedProcessName = escapeShellArg(processName);
      startCommand = `pm2 serve ${escapedPath} ${port} --name ${escapedProcessName} --spa`;
      projectType = 'static';
    } else {
      res.status(400).json({
        error: 'Unable to detect project type. Provide a custom command.',
        hint: 'Supported: package.json (Node), requirements.txt (Python), index.html (Static)',
      });
      return;
    }

    // Execute start command
    try {
      await sshManager.executeCommand(vpsId, startCommand);
    } catch (error: any) {
      res.status(500).json({ error: `Failed to start process: ${error.message}` });
      return;
    }

    // Save deployment record
    const deployment = await prisma.deployment.create({
      data: {
        vpsId,
        projectPath,
        processName,
        port,
        status: 'running',
        startedAt: new Date(),
      },
    });

    res.status(201).json({
      deployment: {
        ...deployment,
        projectType,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /api/vps/:id/processes/:deploymentId/stop
router.post('/:id/processes/:deploymentId/stop', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    const deployment = await prisma.deployment.findFirst({
      where: { id: req.params.deploymentId as string, vpsId },
    });

    if (!deployment) {
      res.status(404).json({ error: 'Deployment not found' });
      return;
    }

    try {
      await sshManager.executeCommand(vpsId, `pm2 stop ${escapeShellArg(deployment.processName)}`);
    } catch (error: any) {
      console.warn(`[Process] PM2 stop warning: ${error.message}`);
    }

    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: 'stopped', stoppedAt: new Date() },
    });

    res.json({ message: 'Process stopped' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/vps/:id/processes/:deploymentId/restart
router.post('/:id/processes/:deploymentId/restart', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    const deployment = await prisma.deployment.findFirst({
      where: { id: req.params.deploymentId as string, vpsId },
    });

    if (!deployment) {
      res.status(404).json({ error: 'Deployment not found' });
      return;
    }

    await sshManager.executeCommand(vpsId, `pm2 restart ${escapeShellArg(deployment.processName)}`);

    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: 'running', startedAt: new Date() },
    });

    res.json({ message: 'Process restarted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/vps/:id/processes/:deploymentId — remove process
router.delete('/:id/processes/:deploymentId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    const deployment = await prisma.deployment.findFirst({
      where: { id: req.params.deploymentId as string, vpsId },
    });

    if (!deployment) {
      res.status(404).json({ error: 'Deployment not found' });
      return;
    }

    // Delete from PM2
    try {
      await sshManager.executeCommand(vpsId, `pm2 delete ${escapeShellArg(deployment.processName)}`);
    } catch {
      // PM2 process might not exist
    }

    await prisma.deployment.delete({ where: { id: deployment.id } });
    res.json({ message: 'Process removed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/vps/:id/processes/:deploymentId/logs — get process logs
router.get('/:id/processes/:deploymentId/logs', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    const deployment = await prisma.deployment.findFirst({
      where: { id: req.params.deploymentId as string, vpsId },
    });

    if (!deployment) {
      res.status(404).json({ error: 'Deployment not found' });
      return;
    }

    const rawLines = parseInt(req.query.lines as string);
    const lines = isNaN(rawLines) ? 100 : Math.max(1, Math.min(1000, rawLines));
    const logs = await sshManager.executeCommand(
      vpsId,
      `pm2 logs ${escapeShellArg(deployment.processName)} --nostream --lines ${lines} 2>&1`
    );

    res.json({ logs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/vps/:id/processes/adopt — take control of an unmanaged workload
router.post('/:id/processes/adopt', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    const { pm_id, processName, projectPath, port, type, pid } = req.body;
    
    // Check if it's already managed
    const existing = await prisma.deployment.findFirst({
      where: { vpsId, processName },
    });
    if (existing) {
      res.status(400).json({ error: 'Process is already managed' });
      return;
    }

    let finalPath = projectPath;
    let finalPort = port ? parseInt(port) : (type === 'port' ? parseInt(port) : 0);
    let finalName = processName;
    let projectType = 'custom';

    if (type === 'port' && pid) {
      // SMART PORT ADOPTION: Kill and Relaunch under PM2
      try {
        // 1. Resolve CWD
        const pwdxOut = await sshManager.executeCommand(vpsId, `readlink -f /proc/${escapeShellArg(pid)}/cwd 2>/dev/null || pwdx ${escapeShellArg(pid)}`);
        const pathPart = pwdxOut.includes(': ') ? pwdxOut.split(': ')[1] : pwdxOut;
        if (pathPart && !finalPath) finalPath = pathPart.trim();
        if (!finalPath) finalPath = '/var/www';

        // 2. Detect project type
        const escapedPath = escapeShellArg(finalPath);
        const files = await sshManager.executeCommand(vpsId, `ls -F ${escapedPath}`);
        const fileList = files.split('\n').map(f => f.trim());

        let startCommand: string;
        finalName = finalName || `adopted-${finalPort}`;
        const escapedProcessName = escapeShellArg(finalName);

        if (fileList.includes('package.json')) {
          startCommand = `cd ${escapedPath} && PORT=${finalPort} pm2 start npm --name ${escapedProcessName} -- start`;
          projectType = 'node';
        } else if (fileList.includes('requirements.txt')) {
          const mainFile = fileList.find(f => f.endsWith('.py') && !f.startsWith('.')) || 'app.py';
          startCommand = `cd ${escapedPath} && pm2 start ${escapeShellArg(mainFile)} --name ${escapedProcessName}`;
          projectType = 'python';
        } else if (fileList.includes('index.html')) {
          startCommand = `pm2 serve ${escapedPath} ${finalPort} --name ${escapedProcessName} --spa`;
          projectType = 'static';
        } else {
          res.status(400).json({ error: 'Unable to detect project type for adoption. Please deploy as new app instead.' });
          return;
        }

        // 3. KILL the old process
        await sshManager.executeCommand(vpsId, `kill -9 ${escapeShellArg(pid)}`);

        // 4. Start under PM2
        await sshManager.executeCommand(vpsId, startCommand);

      } catch (err: any) {
        res.status(500).json({ error: `Port adoption failed (smart logic): ${err.message}` });
        return;
      }
    } else if (pm_id !== undefined && pm_id !== null) {
      // SMART PM2 ADOPTION: Just Link to existing process
      try {
        const pm2Output = await sshManager.executeCommand(vpsId, 'pm2 jlist');
        const processes = JSON.parse(pm2Output);
        const proc = processes.find((p: any) => p.pm_id == pm_id);
        
        if (!proc) {
          res.status(404).json({ error: `PM2 process with ID ${pm_id} not found` });
          return;
        }

        finalName = proc.name;
        finalPath = proc.pm2_env?.pm_cwd || '/var/www';
        finalPort = parseInt(proc.pm2_env?.PORT || proc.pm2_env?.env?.PORT || "0");
        
        // If port is still 0, it might be a static server
        if (finalPort === 0 && proc.name.includes('static')) {
          // Static servers often have port in arg
        }
      } catch (err: any) {
        res.status(500).json({ error: `PM2 adoption failed: ${err.message}` });
        return;
      }
    } else {
      res.status(400).json({ error: 'pm_id or pid required for adoption' });
      return;
    }

    // Save deployment record
    const deployment = await prisma.deployment.create({
      data: {
        vpsId,
        projectPath: finalPath,
        processName: finalName,
        port: finalPort || 80,
        status: 'running',
        startedAt: new Date(),
      },
    });

    res.status(201).json({
      message: 'Workload adopted successfully',
      deployment: { ...deployment, projectType },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
