import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import promBundle from 'express-prom-bundle';
import hpp from 'hpp';
import { globalLimiter } from './middlewares/securityMiddleware';
import logger from './utils/logger';
import { errorHandler } from './middlewares/errorMiddleware';
import { fraudDetectionMiddleware } from './middlewares/fraudMiddleware';
import { cacheMiddleware } from './middlewares/cacheMiddleware';
import { verifyApiSignature } from './middlewares/signatureMiddleware';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import newsRoutes from './routes/news';
import shortsRoutes from './routes/shorts';
import adminRoutes from './routes/admin';
import offerwallRoutes from './routes/offerwall';
import walletRoutes from './routes/wallet';
import referralRoutes from './routes/referral';
import rewardsRoutes from './routes/rewards';
import configRoutes from './routes/config';
import telemetryRoutes from './routes/telemetry';
import marqueeRoutes from './routes/marquee';
import legalRoutes from './routes/legal';
import { startNewsIngestion } from './services/newsIngestionService';
import { startScheduledJobs } from './services/schedulerService';

import './services/queueService'; // Start BullMQ worker

dotenv.config();

if (process.env.NODE_ENV === 'production') {
  const missingSecrets = ['JWT_SECRET', 'API_CLIENT_SECRET'].filter(key => !process.env[key]);
  if (missingSecrets.length > 0) {
    throw new Error(`Missing required production secrets: ${missingSecrets.join(', ')}`);
  }
}

const app = express();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(express.json({ limit: '10kb' })); // Limit body size to prevent payload overflow
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || (allowedOrigins.length === 0 && process.env.NODE_ENV !== 'production')) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
}));
app.use(helmet());
app.use(compression()); // Gzip JSON responses — shorts/news/config payloads were going over the wire uncompressed
app.use(hpp()); // Protect against HTTP Parameter Pollution attacks

app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

const metricsMiddleware = promBundle({
  includeMethod: true, 
  includePath: true, 
  includeStatusCode: true, 
  includeUp: true,
  promClient: {
    collectDefaultMetrics: {}
  }
});
app.use(metricsMiddleware);

app.use(globalLimiter); // Apply global rate limiting
app.use(fraudDetectionMiddleware);

const requireSignature = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const path = req.path;
  if (path.startsWith('/api/webhooks') || path === '/api/rewards/ssv' || path === '/api/health' || path.startsWith('/legal')) {
    return next();
  }
  return verifyApiSignature(req, res, next);
};
app.use(requireSignature);
app.use('/legal', legalRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/news', cacheMiddleware(300), newsRoutes);
app.use('/api/shorts', cacheMiddleware(120), shortsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks/offerwall', offerwallRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/marquee', marqueeRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Rewarded Engagement API is running.' });
});

app.use(errorHandler);

app.listen(Number(PORT), '0.0.0.0', () => {
  logger.info(`Server is running on port ${PORT}`);
  console.log(`Server is running on port ${PORT}`);
  startNewsIngestion();
  startScheduledJobs();
});
