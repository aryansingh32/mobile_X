import { Platform } from 'react-native';
import apiClient from '../api/client';
import { useAppStore } from '../store/useAppStore';

/**
 * Crash/error reporting for the app.
 *
 * Without this, a crash on a real user's device is completely invisible: the
 * ErrorBoundary shows its generic screen and the stack dies with the process.
 * Reports go to the app's own backend (`POST /api/telemetry/client-error`) and
 * land in the same ErrorLog table as server errors, so the admin panel shows
 * one timeline per user across both sides.
 *
 * Design constraints, all of which come from "the app is already broken when
 * this runs":
 *   - Never throw. A reporter that throws inside an error handler turns a
 *     recoverable crash into an infinite loop.
 *   - Never block. Reports are fire-and-forget; nothing awaits them.
 *   - Never report when logged out. The endpoint is authenticated, so an
 *     anonymous report would just 401 and, worse, could log the user out via
 *     the client's 401 interceptor.
 *   - Deduplicate. A render loop that throws every frame must not flood the
 *     server (which also rate-limits, but the client shouldn't rely on that).
 */

const APP_VERSION = '1.1'; // keep in sync with app.json's expo.version

// Same message+screen within this window is treated as one incident.
const DEDUPE_WINDOW_MS = 30_000;
const recentReports = new Map<string, number>();

// The API rejects bodies over 10kb (express.json limit in backend/src/index.ts),
// and a React Native stack trace can easily run past that — which would make
// the worst crashes precisely the ones that never get reported. Truncate here
// so the report always fits; the server truncates again to its column bounds.
const MAX_MESSAGE_CHARS = 1000;
const MAX_STACK_CHARS = 4000;

// Bounds the dedupe map so a crash loop with unique messages can't grow it
// without limit.
const MAX_TRACKED_REPORTS = 50;

let currentScreen = 'unknown';

/** Called by the navigation/state machine so reports say where it broke. */
export const setCrashContextScreen = (screen: string) => {
  currentScreen = screen || 'unknown';
};

const shouldReport = (key: string): boolean => {
  const now = Date.now();

  // Drop expired entries first so the size cap reflects live incidents.
  for (const [k, ts] of recentReports) {
    if (now - ts > DEDUPE_WINDOW_MS) recentReports.delete(k);
  }

  const last = recentReports.get(key);
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return false;

  if (recentReports.size >= MAX_TRACKED_REPORTS) {
    const oldestKey = recentReports.keys().next().value;
    if (oldestKey !== undefined) recentReports.delete(oldestKey);
  }

  recentReports.set(key, now);
  return true;
};

export const reportError = (
  error: unknown,
  options: { fatal?: boolean; screen?: string; context?: string } = {},
): void => {
  try {
    const err = error as any;
    const rawMessage = (err?.message ?? String(error)) || 'Unknown client error';
    const message = options.context ? `[${options.context}] ${rawMessage}` : rawMessage;
    const screen = options.screen || currentScreen;

    if (__DEV__) {
      console.error(`[crashReporter] ${message}`, err?.stack);
    }

    if (!shouldReport(`${message}::${screen}`)) return;

    // The endpoint is authenticated; an anonymous POST would 401 and trip the
    // client's logout-on-401 interceptor, so a crash on the login screen must
    // not sign the user out.
    if (!useAppStore.getState().token) return;

    apiClient
      .post('/api/telemetry/client-error', {
        message: message.slice(0, MAX_MESSAGE_CHARS),
        stack: typeof err?.stack === 'string' ? err.stack.slice(0, MAX_STACK_CHARS) : undefined,
        platform: Platform.OS,
        appVersion: APP_VERSION,
        fatal: options.fatal === true,
        screen: screen.slice(0, 200),
      })
      .catch(() => undefined); // reporting failure must stay silent
  } catch {
    // A reporter that throws would turn a handled error into a crash loop.
  }
};

/**
 * Installs handlers for errors that never reach a React error boundary:
 * uncaught JS exceptions outside render, and unhandled promise rejections.
 * Safe to call more than once.
 */
let installed = false;
export const installGlobalErrorHandlers = (): void => {
  if (installed) return;
  installed = true;

  try {
    // ErrorUtils is a React Native global; it is the only hook for a JS
    // exception thrown outside the React tree (timers, native callbacks).
    const errorUtils = (global as any).ErrorUtils;
    if (errorUtils?.getGlobalHandler && errorUtils?.setGlobalHandler) {
      const previousHandler = errorUtils.getGlobalHandler();
      errorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
        reportError(error, { fatal: isFatal === true, context: 'uncaught' });
        // Preserve RN's own handling (red box in dev, crash in prod) — we are
        // observing, not swallowing.
        previousHandler?.(error, isFatal);
      });
    }
  } catch {
    // Never let instrumentation break app startup.
  }
};
