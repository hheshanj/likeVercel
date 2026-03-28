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

// CORS allowed origins — includes Capacitor Android/iOS WebView origins
const corsOrigins = [
  config.frontendUrl,
  'http://localhost:5173', // Local development
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
];

// Added localhost:5173 to corsOrigins above for all envs.

// Socket.io
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: corsOrigins,
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
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'http://localhost:*', 'http://47.130.218.172:*', 'https:'],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: config.nodeEnv === 'development' ? true : corsOrigins,
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
app.get('/api/health', async (_req, res) => {
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
  const distPath = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    // Index path for SPA routing
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log(`[Server] Production mode: Serving frontend from ${distPath}`);
  } else {
    console.warn(`[Server] Production mode: frontend/dist not found at ${distPath}`);
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
