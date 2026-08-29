import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

// jsdom implements neither of these, and the admin pages use them.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

window.scrollTo = vi.fn();

// The api client's 401 interceptor calls location.reload() to bounce back to
// login. jsdom has no navigation, so stub it — this also makes the reload
// assertable instead of just noisy.
Object.defineProperty(window, 'location', {
  writable: true,
  value: { ...window.location, reload: vi.fn(), assign: vi.fn(), replace: vi.fn() },
});
