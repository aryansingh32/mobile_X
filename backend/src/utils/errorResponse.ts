import { Response } from 'express';
import logger from './logger';

/**
 * Use this instead of `res.status(500).json({ error: error.message })`.
 *
 * Raw error messages (Prisma validation errors, driver errors, unexpected
 * exceptions) can contain internal details — column/table names, query
 * fragments, file paths, library versions — that shouldn't reach a client.
 * This logs the full error (message + stack) server-side via the structured
 * logger, and returns a generic, safe message to the client. In non-production
 * environments the real message is still echoed back to speed up debugging.
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

  const isProd = process.env.NODE_ENV === 'production';
  res.status(statusCode).json({
    error: isProd ? fallbackMessage : (error?.message || fallbackMessage),
  });
};

/**
 * For catch blocks that deliberately throw `Object.assign(new Error('...'),
 * { statusCode: 4xx })` for expected client-facing failures (not found, out
 * of stock, validation, etc.) alongside genuinely unexpected errors that
 * fall through to a 500. When `error.statusCode` is set, the message was
 * authored specifically to be shown to the user, so it's safe to echo.
 * Anything without a statusCode is treated as an internal error — logged in
 * full server-side, genericized to the client.
 */
export const sendControllerError = (res: Response, error: any, fallbackMessage = 'Something went wrong. Please try again.'): void => {
  if (error?.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  sendServerError(res, error, fallbackMessage, error?.statusCode || 500);
};
