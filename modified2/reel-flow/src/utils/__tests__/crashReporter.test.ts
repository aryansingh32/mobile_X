import { reportError, setCrashContextScreen } from '../crashReporter';
import apiClient from '../../api/client';
import { useAppStore } from '../../store/useAppStore';

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { post: jest.fn(() => Promise.resolve({ data: { success: true } })) },
}));

// The real store persists via a dynamic import of expo-secure-store, which
// Jest's CJS runtime can't load. The reporter only reads `token`, so stub the
// store rather than dragging in its persistence machinery.
jest.mock('../../store/useAppStore', () => {
  let state: { token: string | null } = { token: 'test-token' };
  return {
    useAppStore: {
      getState: () => state,
      setState: (next: Partial<typeof state>) => { state = { ...state, ...next }; },
    },
  };
});

const mockPost = apiClient.post as jest.Mock;

/**
 * This module runs when the app is already broken, so its guarantees are
 * mostly about what it must NOT do: never throw, never block, never log the
 * user out, never flood the server.
 */
describe('crashReporter', () => {
  beforeEach(() => {
    mockPost.mockClear();
    mockPost.mockImplementation(() => Promise.resolve({ data: { success: true } }));
    useAppStore.setState({ token: 'test-token' } as any);
    // Each test needs a distinct message to avoid the 30s dedupe window
    // carrying over between tests.
    setCrashContextScreen('home');
  });

  it('reports an error to the backend', () => {
    reportError(new Error('unique-basic-report'));
    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/api/telemetry/client-error');
    expect(body.message).toContain('unique-basic-report');
  });

  it('attaches the screen the user was on, which is what makes a report actionable', () => {
    setCrashContextScreen('wallet');
    reportError(new Error('unique-screen-context'));
    expect(mockPost.mock.calls[0][1].screen).toBe('wallet');
  });

  it('marks fatal crashes distinctly from handled errors', () => {
    reportError(new Error('unique-fatal'), { fatal: true });
    expect(mockPost.mock.calls[0][1].fatal).toBe(true);
    mockPost.mockClear();
    reportError(new Error('unique-nonfatal'));
    expect(mockPost.mock.calls[0][1].fatal).toBe(false);
  });

  it('does not report when logged out, which would 401 and log the user out mid-crash', () => {
    useAppStore.setState({ token: null } as any);
    reportError(new Error('unique-logged-out'));
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('deduplicates a repeated error so a render loop cannot flood the server', () => {
    for (let i = 0; i < 10; i++) reportError(new Error('unique-repeated-crash'));
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('still reports the same message from a different screen', () => {
    setCrashContextScreen('home');
    reportError(new Error('unique-cross-screen'));
    setCrashContextScreen('shorts');
    reportError(new Error('unique-cross-screen'));
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it('truncates message and stack so a deep stack cannot exceed the API body limit', () => {
    // The backend rejects bodies over 10kb; an untruncated RN stack can blow
    // past that, which would mean the worst crashes never get reported.
    const err = new Error('u'.repeat(5000));
    err.stack = 's'.repeat(50_000);
    reportError(err);
    const body = mockPost.mock.calls[0][1];
    expect(body.message.length).toBeLessThanOrEqual(1000);
    expect(body.stack.length).toBeLessThanOrEqual(4000);
    expect(JSON.stringify(body).length).toBeLessThan(10_000);
  });

  it('never throws, even when the network layer throws synchronously', () => {
    mockPost.mockImplementation(() => { throw new Error('network exploded'); });
    expect(() => reportError(new Error('unique-sync-throw'))).not.toThrow();
  });

  it('never throws when the request rejects asynchronously', async () => {
    mockPost.mockImplementation(() => Promise.reject(new Error('offline')));
    expect(() => reportError(new Error('unique-async-reject'))).not.toThrow();
    await Promise.resolve();
  });

  it('handles a non-Error value being thrown', () => {
    expect(() => reportError('unique-string-thrown')).not.toThrow();
    expect(mockPost.mock.calls[0][1].message).toContain('unique-string-thrown');
  });

  it('handles null/undefined being thrown', () => {
    expect(() => reportError(null)).not.toThrow();
    expect(() => reportError(undefined)).not.toThrow();
  });

  it('reports the platform so crashes can be triaged per-OS', () => {
    reportError(new Error('unique-platform'));
    expect(['ios', 'android', 'web']).toContain(mockPost.mock.calls[0][1].platform);
  });

  it('tags the report with a context label when given one', () => {
    reportError(new Error('unique-context-label'), { context: 'render' });
    expect(mockPost.mock.calls[0][1].message).toContain('[render]');
  });
});
