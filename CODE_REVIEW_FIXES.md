# likeVercel-Docker — Code Review Fixes

> Generated: 2026-03-31
> Scope: Backend TypeScript source, Dockerfile, docker-compose.yml, Prisma schemas

---

## Priority fixes

### 1. Dockerfile — replace `db push` with `migrate deploy`

**File:** `Dockerfile`

`prisma db push` is a dev-only command that diffs and mutates the schema without versioning. In production it can silently drop columns. Use `migrate deploy` instead, which applies the versioned migrations in `prisma/migrations/`.

```dockerfile
# Before
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/index.js"]

# After
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

---

### 2. `analyticsService.ts` — move validation inside the function

**File:** `backend/src/services/analyticsService.ts`

Throwing at module load time means the backend crashes on startup if `ANALYTICS_API_URL` or `ANALYTICS_API_SECRET` are absent — even while the analytics call is commented out in `auth.ts`. Move the checks inside the exported function so the error only surfaces when the function is actually called.

```ts
// Before — throws at import time, crashes the process
if (!ANALYTICS_API_URL) {
  throw new Error('ANALYTICS_API_URL environment variable is required');
}

// After — validate lazily inside the function
export async function recordRegistration(payload: RegisterPayload): Promise<void> {
  const url = process.env.ANALYTICS_API_URL;
  const secret = process.env.ANALYTICS_API_SECRET;
  if (!url) throw new Error('ANALYTICS_API_URL is required');
  if (!secret) throw new Error('ANALYTICS_API_SECRET is required');

  const res = await fetch(
    `${url}/projects/likevercel/collections/registrations/records`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Archive API error ${res.status}: ${body}`);
  }
}
```

---

### 3. `SSHManager.ts` — await `disconnect()` inside `disconnectAll()`

**File:** `backend/src/services/SSHManager.ts`

`disconnect()` is async but `disconnectAll()` fires it without `await`, so SSH sessions may still be open when the process exits. The graceful shutdown in `index.ts` also needs to `await` the call.

```ts
// SSHManager.ts — make disconnectAll async
async disconnectAll(): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const [vpsId] of this.connections) {
    promises.push(this.disconnect(vpsId));
  }
  await Promise.all(promises);
}
```

```ts
// index.ts — await it in the graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`[Server] ${signal} received, shutting down gracefully...`);

  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
  });

  await sshManager.disconnectAll(); // was: sshManager.disconnectAll()
  console.log('[SSH] All sessions disconnected');

  await prisma.$disconnect();
  console.log('[DB] Prisma disconnected');

  process.exit(0);
};
```

---

### 4. `docker-compose.yml` — scope the volume to the database file only

**File:** `docker-compose.yml`

Mounting `./backend/prisma:/app/prisma` overwrites the entire prisma directory baked into the image (including the compiled schema and migrations). On a fresh server where that host path doesn't exist yet, the container won't start. Scope the volume to just the `.db` file so the image's schema is preserved.

```yaml
# Before
volumes:
  - ./backend/prisma:/app/prisma

# After — persist only the database file
volumes:
  - ./data/dev.db:/app/prisma/dev.db
```

> Create the `data/` directory on the host before first run: `mkdir -p data`
> Add `data/*.db` to `.gitignore`.

---

### 5. `vps.ts` / `keys.ts` — handle non-EEXIST errors in `sftp.mkdir`

**Files:** `backend/src/routes/vps.ts`, `backend/src/routes/keys.ts`

Both SSH key install routes call `sftp.mkdir('.ssh', ...)` and unconditionally resolve regardless of the error. The intent is to ignore "directory already exists", but any other error (e.g. permission denied) is silently swallowed and the subsequent write to `authorized_keys` fails with a misleading message.

```ts
// Before
await new Promise((resolve, reject) => {
  sftp.mkdir('.ssh', { mode: 0o700 }, (err) => {
    resolve(true); // ignores ALL errors
  });
});

// After — only ignore "already exists"
await new Promise((resolve, reject) => {
  sftp.mkdir('.ssh', { mode: 0o700 }, (err) => {
    // ssh2 reports EEXIST as a generic "Failure" message
    if (err && !err.message.toLowerCase().includes('failure')) {
      reject(new Error(`Failed to create .ssh directory: ${err.message}`));
    } else {
      resolve(true);
    }
  });
});
```

---

## Warnings

### 6. `proxy.ts` — avoid shell-piping the nginx config via `echo`

**File:** `backend/src/routes/proxy.ts`

The nginx config is piped as `echo '${configBase64}' | base64 -d | sudo tee ...`. While base64 output shouldn't contain single quotes, this is fragile. Prefer writing the file directly via SFTP to avoid the shell entirely.

```ts
// After — write via SFTP (no shell escaping concerns)
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
// Then enable the symlink and reload nginx as before
```

---

### 7. `routes/auth.ts` — warn that restore requires a restart

**File:** `backend/src/routes/auth.ts`

After overwriting the SQLite file, `prisma.$connect()` is called but Prisma's connection pool over SQLite doesn't cleanly re-open a replaced file at runtime. The safest approach is to inform the client that a restart is required, rather than attempting a live reconnect.

```ts
// After writing the new db file successfully:
res.json({
  message: 'Database replaced successfully. Restart the server for changes to take effect.',
  requiresRestart: true,
});
```

---

## Improvements

### 8. `prisma/schema.prisma` — add index on `ActivityLog.userId`

**File:** `backend/prisma/schema.prisma`

`ActivityLog` is queried by `userId` (e.g. in the `/activity` route) but has no index on that column, unlike `VpsProfile` and `SshKey`. Add one before logs accumulate.

```prisma
model ActivityLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  details   String
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId]) // add this
}
```

---

### 9. `routes/vps.ts` — merge region detection into one curl call

**File:** `backend/src/routes/vps.ts`

On connect, city and country are fetched in two sequential `executeCommand` calls (each with a 5s timeout). Consolidate into one request to `ipapi.co/json/`.

```ts
try {
  const geoRaw = await sshManager.executeCommand(
    profile.id,
    'curl -s --max-time 5 https://ipapi.co/json/'
  );
  const geo = JSON.parse(geoRaw);
  if (geo.city && geo.country && !geo.error) {
    updateData.region = `${geo.city},${geo.country}`.toUpperCase();
  }
} catch (err) {
  console.warn('[VPS] Region detection failed:', err);
}
```

---

### 10. `routes/vps.ts` / `routes/keys.ts` — convert dynamic imports to top-level

**Files:** `backend/src/routes/vps.ts`, `backend/src/routes/keys.ts`

`child_process`, `os`, `path`, and `fs` are Node built-ins and don't need to be dynamically imported. Move them to the top of the file.

```ts
// Add at the top of the file alongside other imports
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
```

---

### 11. `routes/vps.ts` — type `updateData` with Prisma's generated type

**File:** `backend/src/routes/vps.ts`

Using `const updateData: any = {}` in the PUT route bypasses TypeScript's strict checks on the Prisma payload.

```ts
import { Prisma } from '@prisma/client';

// Replace:
const updateData: any = {};

// With:
const updateData: Prisma.VpsProfileUpdateInput = {};
```

---

### 12. `routes/ports.ts` — use `ss` filter syntax for port checks

**File:** `backend/src/routes/ports.ts`

`ss -tlnp | grep ":${portNum} "` can produce false positives (e.g. checking port 80 may match port 8080). Use `ss`'s native filter expression instead.

```ts
const output = await sshManager.executeCommand(
  vpsId,
  `ss -tlnp 'sport = :${portNum}' | grep -c LISTEN || echo 0`
);
const isUsed = parseInt(output.trim()) > 0;
```

---

## What's already good

- Shell argument escaping via `escapeShellArg` is thorough and applied consistently across all route handlers.
- AES-256-GCM encryption with per-record IV and auth tag is correctly implemented in `crypto.ts`.
- Path sanitization in `files.ts` handles null bytes, URI encoding, and `..` traversal correctly.
- Graceful shutdown structure in `index.ts` is well-organized (once `disconnectAll` is awaited — see fix #3).
- WebSocket connection limits per user (`MAX_CONNECTIONS_PER_USER = 5`) are a nice safeguard.
