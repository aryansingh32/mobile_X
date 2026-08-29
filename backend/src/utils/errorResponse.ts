import { Response } from 'express';
import logger from './logger';
import prisma from '../config/db';

// Only these are treated as "safe to show real error text" environments.
// Deliberately inverted from a naive `NODE_ENV === 'production'` check: if
// NODE_ENV is ever unset, misspelled, or set to something unrecognized in a
// real deployment (a real, easy-to-make ops mistake — this app doesn't set
// NODE_ENV anywhere in railway.json or package.json itself, it depends on
// the host setting it), the safe behavior must be the DEFAULT, not something
// that only kicks in when a specific string happens to match. Failing open
// to "leak real error messages" on a misconfigured environment is exactly
// the kind of gap that shows up in production and nowhere in dev.
const VERBOSE_ENVIRONMENTS = new Set(['development', 'test']);
const isVerboseEnv = () => VERBOSE_ENVIRONMENTS.has(process.env.NODE_ENV || '');

// Fire-and-forget — an error log write must never itself throw or block the
// response the user is waiting on. `res.req` is a standard Express back-
// reference to the request, so every existing sendServerError/sendControllerError
// call site gets this for free with no signature change.
const recordErrorLog = (res: Response, error: any, statusCode: number) => {
  try {
    const req = res.req as any;
    prisma.errorLog.create({
      data: {
        userId: req?.user?.id ?? null,
        method: req?.method ?? 'UNKNOWN',
        path: (req?.originalUrl ?? req?.url ?? 'unknown').split('?')[0].slice(0, 500),
        statusCode,
        message: String(error?.message ?? 'Unknown error').slice(0, 2000),
        stack: error?.stack ? String(error.stack).slice(0, 8000) : null,
      },
    }).catch(() => undefined);
  } catch {
    // Never let logging itself break the error response it's logging.
  }
};

/**
 * Use this instead of `res.status(500).json({ error: error.message })`.
 *
 * Raw error messages (Prisma validation errors, driver errors, unexpected
 * exceptions) can contain internal details — column/table names, query
 * fragments, file paths, library versions — that shouldn't reach a client.
 * This logs the full error (message + stack) both to the structured logger
 * AND to the ErrorLog table (queryable per-user in the admin panel — see
 * adminController.ts's getErrorLogs / getUserIntelligence), and returns a
 * generic, safe message to the client. Only in development/test does the
 * real message get echoed back, to speed up local debugging.
 */
export const sendServerError = (
  res: Response,
  error: any,
  fallbackMessage = 'Something went wrong. Please try again.',
  // Callers that don't pass an explicit statusCode still get the right one
  // for errors deliberately annotated with `.statusCode` (e.g. ledgerService's
  // "Insufficient coin balance") — previously every sendServerError(res, error)
  // call defaulted straight to 500 regardless of what the error actually was,
  // which is exactly the class of bug live end-to-end testing caught: a
  // routine "not enough coins" response surfacing as a server fault.
  statusCode = error?.statusCode || 500,
): void => {
  logger.error(error?.message || 'Unknown error', {
    stack: error?.stack,
    code: error?.code,
  });
  recordErrorLog(res, error, statusCode);

  res.status(statusCode).json({
    error: isVerboseEnv() ? (error?.message || fallbackMessage) : fallbackMessage,
  });
};

/**
 * For catch blocks that deliberately throw `Object.assign(new Error('...'),
 * { statusCode: 4xx })` for expected client-facing failures (not found, out
 * of stock, validation, etc.) alongside genuinely unexpected errors that
 * fall through to a 500. When `error.statusCode` is set, the message was
 * authored specifically to be shown to the user, so it's safe to echo —
 * these are NOT recorded in ErrorLog (they're routine, expected outcomes,
 * not bugs to investigate). Anything without a statusCode is treated as an
 * internal error — logged in full server-side, genericized to the client.
 */
export const sendControllerError = (res: Response, error: any, fallbackMessage = 'Something went wrong. Please try again.'): void => {
  if (error?.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  sendServerError(res, error, fallbackMessage, error?.statusCode || 500);
};
