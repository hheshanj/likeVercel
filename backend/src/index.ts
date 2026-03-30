import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { setupTerminalWebSocket } from './websocket/terminal';
import prisma from './utils/prisma';
import { sshManager } from './services/SSHManager';

// Routes
import authRoutes from './routes/auth';
import vpsRoutes from './routes/vps';
import fileRoutes from './routes/files';
import processRoutes from './routes/processes';
import portRoutes from './routes/ports';
import proxyRoutes from './routes/proxy';
import keyRoutes from './routes/keys';

const app = express();
const httpServer = createServer(app);

// Socket.io
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.frontendUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Simple request logger (Fix 17)
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com", "ws:", "wss:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Increased for polling dashboard
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Auth routes have more lenient rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Increased for frequent login/refresh
  message: { error: 'Too many auth attempts, please try again later' },
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/vps', vpsRoutes);
app.use('/api/vps', fileRoutes);
app.use('/api/vps', processRoutes);
app.use('/api/vps', portRoutes);
app.use('/api/vps', proxyRoutes);
app.use('/api/keys', keyRoutes);

// Health check with DB ping (Fix 18)
app.get('/api/health', async (_req: Request, res: Response) => {
  let dbStatus = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    dbStatus = 'down';
  }

  res.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    database: dbStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Serve static files in production
if (config.nodeEnv === 'production') {
  // Check common locations for frontend/dist
  const possiblePaths = [
    path.resolve(__dirname, '../../frontend/dist'), // Local dev structure
    path.resolve(__dirname, '../frontend/dist'),    // Docker structure (/app/dist/index.js -> /app/frontend/dist)
    path.resolve(process.cwd(), 'frontend/dist')    // Process root
  ];

  let distPath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      distPath = p;
      break;
    }
  }

  if (distPath) {
    app.use(express.static(distPath));
    // Index path for SPA routing
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log(`[Server] Production mode: Serving frontend from ${distPath}`);
  } else {
    console.error(`[Server] ERROR: Production mode enabled but frontend/dist not found in searched paths: ${possiblePaths.join(', ')}`);
  }
}

// Error handler
app.use(errorHandler);

// WebSocket
setupTerminalWebSocket(io);

// Start server
httpServer.listen(config.port, () => {
  console.log(`\n🚀 VPS Deployment Platform API`);
  console.log(`   Server running on http://localhost:${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Frontend URL: ${config.frontendUrl}\n`);
});

// Graceful shutdown (Fix 16)
const gracefulShutdown = async (signal: string) => {
  console.log(`[Server] ${signal} received, shutting down gracefully...`);
  
  // Close HTTP server
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
  });

  // Disconnect all SSH sessions
  sshManager.disconnectAll();
  console.log('[SSH] All sessions disconnected');

  // Disconnect Prisma
  await prisma.$disconnect();
  console.log('[DB] Prisma disconnected');

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, httpServer, io };
