import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getRequiredSecret } from '../config/secrets';
import { redisConnection } from '../services/queueService';
import logger from '../utils/logger';

export const verifyApiSignature = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const signature = req.headers['x-api-signature'];
    const timestamp = req.headers['x-api-timestamp'];
    const nonce = req.headers['x-api-nonce'];
    
    if (!signature || !timestamp || !nonce) {
      res.status(401).json({ error: 'Missing API signature, timestamp, or nonce' });
      return;
    }

    // Prevent replay attacks (5 minute window)
    const now = Date.now();
    if (now - parseInt(timestamp as string) > 5 * 60 * 1000) {
      res.status(401).json({ error: 'Request timestamp expired' });
      return;
    }

    // Nonce check
    try {
      const nonceKey = `nonce:${nonce}`;
      // SETNX returns 1 if key was set (meaning it didn't exist), 0 if it existed
      const isNewNonce = await redisConnection.setnx(nonceKey, '1');
      if (!isNewNonce) {
        res.status(401).json({ error: 'Replay attack detected: nonce already used' });
        return;
      }
      // Expire nonce after 6 minutes (safely past the 5 minute timestamp window)
      await redisConnection.expire(nonceKey, 360);
    } catch (error: any) {
      logger.error('Redis unavailable for nonce check, failing closed', { error: error?.message });
      res.status(503).json({ error: 'Service Unavailable (Security Check Failed)' });
      return;
    }

  // If the request has no body or an empty body, config.data on frontend is undefined, 
  // so frontend signs ''. We must match that.
  let bodyString = '';
  if (req.body && Object.keys(req.body).length > 0) {
    // Prevent DoS from deeply nested objects
    const MAX_DEPTH = 5;
    const sortObjectKeys = (obj: any, depth = 0): any => {
      if (depth > MAX_DEPTH) return obj; // Stop recursing
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(item => sortObjectKeys(item, depth + 1));
      return Object.keys(obj).sort().reduce((acc: any, key) => {
        acc[key] = sortObjectKeys(obj[key], depth + 1);
        return acc;
      }, {});
    };
    try {
      bodyString = JSON.stringify(sortObjectKeys(req.body));
      if (bodyString.length > 50000) { // Limit payload size to 50KB for signature
        throw new Error('Payload too large');
      }
    } catch (e) {
      res.status(400).json({ error: 'Invalid payload structure' });
      return;
    }
  }
    const payload = bodyString + timestamp + nonce;
    
    const expectedSignature = crypto
      .createHmac('sha256', getRequiredSecret('API_CLIENT_SECRET'))
      .update(payload)
      .digest('hex');

    const signatureBuffer = Buffer.from(String(signature), 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      res.status(401).json({ error: 'Invalid API signature' });
      return;
    }

    next();
  } catch (error: any) {
    res.status(500).json({ error: 'Signature verification failed' });
  }
};
