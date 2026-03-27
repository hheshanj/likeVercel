import prisma from '../utils/prisma';

export async function logActivity(userId: string, action: string, details: string): Promise<void> {
  try {
    await prisma.activityLog.create({ data: { userId, action, details } });
  } catch (err) {
    // Non-critical — don't throw, just log
    console.warn('[Activity] Failed to write activity log:', err);
  }
}
