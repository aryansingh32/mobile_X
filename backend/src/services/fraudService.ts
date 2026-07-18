import prisma from '../config/db';

export const logFraud = async (userId: number, reason: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', metadata?: any) => {
  try {
    await prisma.fraudIncident.create({
      data: {
        userId,
        reason,
        severity,
        metadata: metadata ? JSON.stringify(metadata) : null,
      }
    });

    if (severity === 'HIGH') {
      // Potentially suspend user automatically or notify admin via webhook
      console.warn(`HIGH SEVERITY FRAUD DETECTED for user ${userId}: ${reason}`);
    }
  } catch (error) {
    console.error('Error logging fraud:', error);
  }
};

export const checkWatchFraud = async (userId: number, watchSeconds: number, videoId: string): Promise<boolean> => {
  // E.g., watchSeconds should not be more than 60, or watching 100 shorts in a minute.
  if (watchSeconds > 120) {
    await logFraud(userId, 'UNREALISTIC_WATCH_TIME', 'HIGH', { videoId, watchSeconds });
    return true; // Fraud detected
  }
  return false;
};
