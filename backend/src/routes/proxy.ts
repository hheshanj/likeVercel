import { Router, Response } from 'express';
import prisma from '../utils/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sshManager } from '../services/SSHManager';

const router = Router();
router.use(authMiddleware);

// Helper: verify VPS ownership and connection
async function verifyVps(req: AuthRequest, res: Response): Promise<string | null> {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const profile = await prisma.vpsProfile.findFirst({
    where: { id: req.params.id as string, userId: req.userId },
  });
  if (!profile) {
    res.status(404).json({ error: 'VPS profile not found' });
    return null;
  }
  if (!sshManager.isConnected(profile.id)) {
    res.status(400).json({ error: 'VPS not connected' });
    return null;
  }
  return profile.id;
}

// Helper: escape single quotes for shell
function shellEscape(str: string): string {
  return str.replace(/'/g, "'\\''");
}

// Generate Nginx server block config
function generateNginxConfig(domain: string, port: number, ssl: boolean = false): string {
  const upstream = `http://127.0.0.1:${port}`;

  if (ssl) {
    return `server {
    listen 80;
    server_name ${domain};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${domain};

    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass ${upstream};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}`;
  }

  return `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass ${upstream};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}`;
}

// GET /api/vps/:id/proxy — list all proxy configs
router.get('/:id/proxy', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    // List files in sites-available managed by us (prefixed with 'vdp-')
    const output = await sshManager.executeCommand(
      vpsId,
      'ls /etc/nginx/sites-available/vdp-* 2>/dev/null || echo ""'
    );

    const configs: Array<{
      domain: string;
      port: number;
      ssl: boolean;
      enabled: boolean;
      fileName: string;
    }> = [];

    if (output.trim()) {
      const files = output.trim().split('\n').filter(Boolean);

      for (const filePath of files) {
        const fileName = filePath.split('/').pop() || '';
        try {
          const content = await sshManager.executeCommand(vpsId, `cat '${shellEscape(filePath)}'`);

          // Parse domain from server_name
          const domainMatch = content.match(/server_name\s+([^\s;]+)/);
          // Parse port from proxy_pass
          const portMatch = content.match(/proxy_pass\s+http:\/\/127\.0\.0\.1:(\d+)/);
          // Check if SSL is configured
          const hasSSL = content.includes('listen 443 ssl');

          // Check if enabled (symlink exists in sites-enabled)
          let enabled = false;
          try {
            await sshManager.executeCommand(vpsId, `test -L /etc/nginx/sites-enabled/${shellEscape(fileName)}`);
            enabled = true;
          } catch {
            enabled = false;
          }

          if (domainMatch && portMatch) {
            configs.push({
              domain: domainMatch[1],
              port: parseInt(portMatch[1]),
              ssl: hasSSL,
              enabled,
              fileName,
            });
          }
        } catch {
          // Skip unreadable files
        }
      }
    }

    // Check if nginx is installed
    let nginxInstalled = false;
    try {
      await sshManager.executeCommand(vpsId, 'which nginx');
      nginxInstalled = true;
    } catch {
      nginxInstalled = false;
    }

    res.json({ configs, nginxInstalled });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/vps/:id/proxy — create a new proxy config
router.post('/:id/proxy', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    const { domain, port, ssl } = req.body;
    if (!domain || !port) {
      res.status(400).json({ error: 'Domain and port are required' });
      return;
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      res.status(400).json({ error: 'Invalid domain format' });
      return;
    }

    const fileName = `vdp-${domain.replace(/\./g, '-')}`;
    const config = generateNginxConfig(domain, port, false); // Always start without SSL

    // Write config using base64 to avoid shell escaping issues with $variables
    const configBase64 = Buffer.from(config).toString('base64');
    await sshManager.executeCommand(
      vpsId,
      `echo '${configBase64}' | base64 -d | sudo tee /etc/nginx/sites-available/${fileName} > /dev/null`
    );

    // Enable it (symlink to sites-enabled)
    await sshManager.executeCommand(
      vpsId,
      `sudo ln -sf /etc/nginx/sites-available/${fileName} /etc/nginx/sites-enabled/${fileName}`
    );

    // Test nginx config
    try {
      await sshManager.executeCommand(vpsId, 'sudo nginx -t 2>&1');
    } catch (testErr: any) {
      // Rollback on failure
      await sshManager.executeCommand(vpsId, `sudo rm -f /etc/nginx/sites-enabled/${fileName} /etc/nginx/sites-available/${fileName}`);
      res.status(400).json({ error: `Nginx config test failed: ${testErr.message}` });
      return;
    }

    // Reload nginx
    await sshManager.executeCommand(vpsId, 'sudo systemctl reload nginx');

    // If SSL requested, run certbot after nginx is reloaded with HTTP config
    if (ssl) {
      try {
        // Install certbot if not present
        await sshManager.executeCommand(
          vpsId,
          'which certbot || (sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx)',
          120000
        );

        // Run certbot
        await sshManager.executeCommand(
          vpsId,
          `sudo certbot --nginx -d ${domain} --non-interactive --agree-tos --register-unsafely-without-email --redirect`,
          120000
        );
      } catch (certErr: any) {
        // SSL failed but HTTP proxy still works
        res.json({
          message: `Proxy created for ${domain}. SSL setup failed: ${certErr.message}. HTTP proxy is still active.`,
          domain,
          port,
          ssl: false,
          sslError: certErr.message,
        });
        return;
      }
    }

    res.json({
      message: `Proxy created for ${domain} -> port ${port}`,
      domain,
      port,
      ssl: !!ssl,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/vps/:id/proxy/:domain — remove a proxy config
router.delete('/:id/proxy/:domain', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    const domain = req.params.domain as string;
    const fileName = `vdp-${domain.replace(/\./g, '-')}`;

    // Remove symlink and config
    await sshManager.executeCommand(
      vpsId,
      `sudo rm -f /etc/nginx/sites-enabled/${fileName} /etc/nginx/sites-available/${fileName}`
    );

    // Reload nginx
    await sshManager.executeCommand(vpsId, 'sudo systemctl reload nginx');

    res.json({ message: `Proxy for ${domain} removed` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/vps/:id/proxy/:domain/ssl — add SSL to existing config
router.post('/:id/proxy/:domain/ssl', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    const domain = req.params.domain;

    // Install certbot if not present
    await sshManager.executeCommand(
      vpsId,
      'which certbot || (sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx)',
      120000
    );

    // Run certbot
    await sshManager.executeCommand(
      vpsId,
      `sudo certbot --nginx -d ${domain} --non-interactive --agree-tos --register-unsafely-without-email --redirect`,
      120000
    );

    res.json({ message: `SSL certificate installed for ${domain}` });
  } catch (error: any) {
    res.status(500).json({ error: `SSL setup failed: ${error.message}` });
  }
});

// POST /api/vps/:id/proxy/install-nginx — install nginx
router.post('/:id/proxy/install-nginx', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    await sshManager.executeCommand(
      vpsId,
      'sudo apt-get update && sudo apt-get install -y nginx',
      120000
    );

    // Start and enable nginx
    await sshManager.executeCommand(vpsId, 'sudo systemctl start nginx && sudo systemctl enable nginx');

    res.json({ message: 'Nginx installed and started successfully' });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to install Nginx: ${error.message}` });
  }
});

export default router;
