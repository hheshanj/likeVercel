import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sshManager } from '../services/SSHManager';
import { verifyVps, escapeShellArg } from '../utils/helpers';

const router = Router();
router.use(authMiddleware);

const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;



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

    // List all files in sites-available (to find both managed and external)
    const output = await sshManager.executeCommand(
      vpsId,
      'ls /etc/nginx/sites-available/ 2>/dev/null || echo ""'
    );

    const configs: Array<{
      domain: string;
      port: number;
      ssl: boolean;
      enabled: boolean;
      fileName: string;
      managed: boolean;
    }> = [];

    if (output.trim()) {
      const files = output.trim().split('\n').filter(f => f.trim() && f !== 'default' && f !== 'default.dpkg-dist');

      for (const fileName of files) {
        const filePath = `/etc/nginx/sites-available/${fileName}`;
        try {
          const content = await sshManager.executeCommand(vpsId, `cat ${escapeShellArg(filePath)}`);

          // Parse domains from server_name (can be multiple)
          const domainMatch = content.match(/server_name\s+([^;]+)/);
          // Parse port from proxy_pass
          const portMatch = content.match(/proxy_pass\s+http?:\/\/(?:localhost|127\.0\.0\.1|[\d\.]+):(\d+)/);
          const hasSSL = content.includes('listen 443 ssl');

          let enabled = false;
          try {
            await sshManager.executeCommand(vpsId, `test -L /etc/nginx/sites-enabled/${escapeShellArg(fileName)}`);
            enabled = true;
          } catch {
            enabled = false;
          }

          if (domainMatch && portMatch) {
            // Take the first domain if multiple
            const domain = domainMatch[1].trim().split(/\s+/)[0];
            configs.push({
              domain,
              port: parseInt(portMatch[1]),
              ssl: hasSSL,
              enabled,
              fileName,
              managed: fileName.startsWith('vdp-'),
            });
          }
        } catch { }
      }
    }

    let nginxInstalled = false;
    try {
      await sshManager.executeCommand(vpsId, 'which nginx');
      nginxInstalled = true;
    } catch { }

    res.json({ configs, nginxInstalled });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/vps/:id/proxy/adopt — take control of an external nginx config
router.post('/:id/proxy/adopt', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vpsId = await verifyVps(req, res);
    if (!vpsId) return;

    const { domain, fileName } = req.body;
    if (!domain || !fileName) {
      res.status(400).json({ error: 'Domain and fileName are required' });
      return;
    }

    if (fileName.startsWith('vdp-')) {
      res.status(400).json({ error: 'Already managed' });
      return;
    }

    const newFileName = `vdp-${domain.replace(/\./g, '-')}`;

    // 1. Check if it was enabled
    let wasEnabled = false;
    try {
      await sshManager.executeCommand(vpsId, `test -L /etc/nginx/sites-enabled/${escapeShellArg(fileName)}`);
      wasEnabled = true;
    } catch { }

    // 2. Rename the file
    await sshManager.executeCommand(vpsId, `sudo mv /etc/nginx/sites-available/${escapeShellArg(fileName)} /etc/nginx/sites-available/${escapeShellArg(newFileName)}`);

    // 3. Update symlink if it was enabled
    if (wasEnabled) {
      await sshManager.executeCommand(vpsId, `sudo rm -f /etc/nginx/sites-enabled/${escapeShellArg(fileName)}`);
      await sshManager.executeCommand(vpsId, `sudo ln -sf /etc/nginx/sites-available/${escapeShellArg(newFileName)} /etc/nginx/sites-enabled/${escapeShellArg(newFileName)}`);
    }

    // 4. Test and reload
    await sshManager.executeCommand(vpsId, 'sudo nginx -t && sudo systemctl reload nginx');

    res.json({ message: `Successfully adopted ${domain}`, newFileName });
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

    // Validate domain format (allows subdomains like api.example.com)
    if (!DOMAIN_REGEX.test(domain)) {
      res.status(400).json({ error: 'Invalid domain format' });
      return;
    }

    const fileName = `vdp-${domain.replace(/\./g, '-')}`;
    const config = generateNginxConfig(domain, port, false); // Always start without SSL

    // Write config via SFTP to avoid shell escaping concerns
    const sftp = await sshManager.getSftp(vpsId);
    try {
      await new Promise<void>((resolve, reject) => {
        const stream = sftp.createWriteStream(
          `/etc/nginx/sites-available/${fileName}`,
          { flags: 'w', mode: 0o644 }
        );
        stream.on('error', reject);
        stream.on('close', () => resolve());
        stream.end(config);
      });
    } finally {
      sftp.end();
    }

    // Enable it (symlink to sites-enabled)
    await sshManager.executeCommand(
      vpsId,
      `sudo ln -sf /etc/nginx/sites-available/${escapeShellArg(fileName)} /etc/nginx/sites-enabled/${escapeShellArg(fileName)}`
    );

    // Test nginx config
    try {
      await sshManager.executeCommand(vpsId, 'sudo nginx -t 2>&1');
    } catch (testErr: any) {
      // Rollback on failure
      await sshManager.executeCommand(vpsId, `sudo rm -f /etc/nginx/sites-enabled/${escapeShellArg(fileName)} /etc/nginx/sites-available/${escapeShellArg(fileName)}`);
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
          `sudo certbot --nginx -d ${escapeShellArg(domain)} --non-interactive --agree-tos --register-unsafely-without-email --redirect`,
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
    if (!DOMAIN_REGEX.test(domain)) {
      res.status(400).json({ error: 'Invalid domain format' });
      return;
    }
    const fileName = `vdp-${domain.replace(/\./g, '-')}`;

    // Remove symlink and config
    await sshManager.executeCommand(
      vpsId,
      `sudo rm -f /etc/nginx/sites-enabled/${escapeShellArg(fileName)} /etc/nginx/sites-available/${escapeShellArg(fileName)}`
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

    const domain = req.params.domain as string;
    if (!DOMAIN_REGEX.test(domain)) {
      res.status(400).json({ error: 'Invalid domain format' });
      return;
    }

    // Install certbot if not present
    await sshManager.executeCommand(
      vpsId,
      'which certbot || (sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx)',
      120000
    );

    // Run certbot
    await sshManager.executeCommand(
      vpsId,
      `sudo certbot --nginx -d ${escapeShellArg(domain)} --non-interactive --agree-tos --register-unsafely-without-email --redirect`,
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
