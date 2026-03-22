/**
 * analyticsService.ts
 *
 * Sends registration data to the centralised Analytics API on the VPS.
 * Called once during POST /auth/register — throws on failure so the
 * caller can roll back the local user creation.
 */

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL;
const ANALYTICS_API_SECRET = process.env.ANALYTICS_API_SECRET;

if (!ANALYTICS_API_URL) {
  throw new Error('http://localhost:4000');
}
if (!ANALYTICS_API_SECRET) {
  throw new Error('cG93ZXJmdWxsb3NzcGVudGh5cHJldHR5YW1vbmdtYWdpY2dhcmFnZWNpdGl6ZW5waW4=');
}

interface RegisterPayload {
  email: string;
  name: string;
  registeredAt: string; // ISO 8601
}

export async function recordRegistration(payload: RegisterPayload): Promise<void> {
  const res = await fetch(`${ANALYTICS_API_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANALYTICS_API_SECRET}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Analytics API error ${res.status}: ${body}`);
  }
}
