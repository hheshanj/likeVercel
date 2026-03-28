---

# ⚡ likeVercel

A self-hosted VPS management dashboard. Connect to your servers over SSH and manage everything from a single browser interface.

> Built with React, Node.js, Prisma, and Socket.io. No cloud account required.

---

## Features

- **Terminal** — Full SSH shell in the browser. Tabs stay alive when switching.
- **File Manager** — Browse, rename, move, delete, and upload files (up to 100MB) via SFTP.
- **Process Manager** — PM2 GUI with live logs. Auto-detects existing processes on connect.
- **Resource Monitor** — Real-time CPU and RAM usage.
- **Port Auditor** — View and manage all active listening ports.
- **Domain Proxy** — Map domains to internal ports.
- **SSH Key Manager** — Generate Ed25519 keypairs, install public keys to servers, store private keys encrypted.
- **Credential Vault** — All passwords and keys encrypted with AES-256-GCM at rest.

---

## Setup

### Prerequisites
- Docker (recommended), or Node.js 20+

### 1. Clone & configure

```bash
git clone https://github.com/your-username/likeVercel.git
cd likeVercel
cp .env.example .env
```

Fill in `.env`:

```env
JWT_SECRET=your-long-random-string
JWT_REFRESH_SECRET=another-long-random-string
ENCRYPTION_KEY=a-64-character-hex-string   # openssl rand -hex 32
```

### 2. Run

**Docker (recommended)**
```bash
docker compose up --build
```

**Local**
```bash
npm run install:all
cd backend && npm run db:push
npm run dev
```

App runs at **http://localhost:3001**

---

## Reset Account

Only one admin account is allowed. To reset:

**Docker:** `docker compose down -v && docker compose up`

**Local:** Delete `backend/prisma/dev.db` and run `npm run db:push`

---

MIT License. Created by Heshan Jayakody.

---
