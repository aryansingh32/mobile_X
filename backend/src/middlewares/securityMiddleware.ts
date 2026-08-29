import rateLimit from 'express-rate-limit';
import { RedisRateLimitStore } from './redisRateLimitStore';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('global'),
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 login requests per windowMs
  message: 'Too many login attempts from this IP, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('auth'),
});

// Crash reports come from a device that is, by definition, misbehaving — a
// render loop that throws every frame could otherwise flood ErrorLog. This
// caps the damage while still letting a genuinely crashing client report.
export const clientErrorLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30,
  message: 'Too many client error reports',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('client-error'),
});

export const withdrawalLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 1 day
  max: 5, // 5 withdrawal requests per day per IP
  message: 'Daily withdrawal request limit reached',
  store: new RedisRateLimitStore('withdrawal'),
});
