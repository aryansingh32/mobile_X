import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { addLedgerEntry } from './ledgerService';
import { addExp } from './expService';
import logger from '../utils/logger';

export const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379/0', {
  maxRetriesPerRequest: null,
});

export const eventQueue = new Queue('reward-events', { connection: redisConnection as any });

const worker = new Worker('reward-events', async job => {
  if (job.name === 'WATCH_COMPLETED') {
    const { userId, coinsEarned, xpEarned, clientIp, videoId } = job.data;
    logger.info(`Processing WATCH_COMPLETED for user ${userId}`);
    
    // Check if shadow banned (would be loaded from DB/Cache in real implementation)
    // Add ledger entry
    if (coinsEarned > 0) {
      await addLedgerEntry(userId, coinsEarned, 'WATCH_SHORTS', clientIp, undefined, videoId);
    }
    if (xpEarned > 0) {
      await addExp(userId, xpEarned);
    }
  }
}, { connection: redisConnection as any });

worker.on('completed', job => {
  logger.info(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed:`, err);
});
