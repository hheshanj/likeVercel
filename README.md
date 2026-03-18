# VPS Deployment Platform (VDP)

A robust, full-stack management suite for remote servers. Orchestrate your infrastructure with a professional, laboratory-grade interface.

![Laboratory UI](https://via.placeholder.com/800x450.png?text=VPS+Deployment+Platform+Dashboard)

## 🚀 Key Capabilities

- **Unified Dashboard**: Real-time monitoring of your entire server grid with live status indicators.
- **Remote Terminal**: Full-featured SSH terminal access directly in your browser using WebSockets and Xterm.js.
- **Node Management**: Securely manage multiple VPS endpoints with encrypted credentials (AES-256-GCM).
- **File System Explorer**: Browse, upload, download, and manage remote files through an integrated SFTP manager.
- **App Deployment**: High-level orchestration for Node.js, Python, and static sites using PM2.
- **Connectivity Suite**: integrated port mapping, domain proxies, and network diagnostics.
- **Security First**: JWT-based session management, refresh token rotation, and hardware-accelerated encryption.

## 🛠 Tech Stack

### Frontend
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS (Custom "Laboratory" Theme)
- **Icons**: Lucide React
- **Terminal**: Xterm.js + Socket.io-client

### Backend
- **Runtime**: Node.js + Express
- **Database**: SQLite (via Prisma ORM)
- **Communication**: Socket.io (WebSockets)
- **SSH/SFTP**: SSH2
- **Security**: JWT, Bcrypt, AES-256-GCM, Helmet


## 🏁 Getting Started

### 1. Installation
Install dependencies for the entire workspace:

```bash
npm run install:all
```

### 2. Environment Setup
Create a `.env` file in the root or `backend/` directory:


### 3. Database Initialization
```bash
cd backend
npm run db:push
```

### 4. Run Development
Run both frontend and backend concurrently:

```bash
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

## 🚢 Production Deployment

To deploy to your own VPS:

1. Build the project:
   ```bash
   npm run build
   ```
2. Set `NODE_ENV=production` in your `.env`.
3. Start the backend with PM2:
   ```bash
   pm2 start backend/dist/index.js --name "vps-platform"
   ```

The backend is configured to serve the frontend static files automatically in production mode.

## ⚖️ License
MIT License. Created by Heshan Jayakody.
