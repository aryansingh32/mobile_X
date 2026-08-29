import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';

// The real store persists via a dynamic import of expo-secure-store, which
// Jest's CJS runtime can't load. The client only reads `token` and writes the
// offline/logout flags, so stub it and record what the interceptors do.
const mockStoreState: any = {
  token: 'test-token',
  isOffline: false,
  setOffline: jest.fn((v: boolean) => { mockStoreState.isOffline = v; }),
  logout: jest.fn(),
};
jest.mock('../../store/useAppStore', () => ({
  useAppStore: {
    getState: () => mockStoreState,
    setState: (next: any) => Object.assign(mockStoreState, next),
  },
}));

jest.mock('react-native', () => ({ Alert: { alert: jest.fn() } }));

import apiClient from '../client';
import { Alert } from 'react-native';

const mock = new MockAdapter(apiClient);

/**
 * Offline and flaky-network behavior. A mobile app on a train spends real time
 * in this code path, and the failure modes are user-visible: a spurious logout,
 * a silent no-op, or a retry storm against a struggling server.
 */
describe('api client — retries on a flaky network', () => {
  beforeEach(() => {
    mock.reset();
    mockStoreState.token = 'test-token';
    mockStoreState.isOffline = false;
    mockStoreState.setOffline.mockClear();
    mockStoreState.logout.mockClear();
    (Alert.alert as jest.Mock).mockClear();
  });

  it('retries a failed GET and succeeds when the network comes back', async () => {
    // networkErrorOnce produces a real axios network error (no response, with
    // the original config attached), which is what the retry interceptor keys
    // off — a plain rejected promise would not carry that shape.
    mock.onGet('/api/shorts').networkErrorOnce();
    mock.onGet('/api/shorts').networkErrorOnce();
    mock.onGet('/api/shorts').reply(200, { items: [] });

    const res = await apiClient.get('/api/shorts');
    expect(res.status).toBe(200);
    expect(mock.history.get.length).toBe(3);
  });

  it('gives up after a bounded number of retries instead of hammering the server', async () => {
    mock.onGet('/api/shorts').networkError();

    await expect(apiClient.get('/api/shorts')).rejects.toBeTruthy();
    // 1 initial attempt + 2 retries. The point is that it is bounded.
    expect(mock.history.get.length).toBe(3);
  });

  it('flags the app offline once retries are exhausted, so the UI can react', async () => {
    mock.onGet('/api/shorts').networkError();
    await expect(apiClient.get('/api/shorts')).rejects.toBeTruthy();
    expect(mockStoreState.setOffline).toHaveBeenCalledWith(true);
  });

  it('clears the offline flag on the next successful response', async () => {
    mockStoreState.isOffline = true;
    mock.onGet('/api/news').reply(200, { items: [] });

    await apiClient.get('/api/news');
    expect(mockStoreState.setOffline).toHaveBeenCalledWith(false);
  });

  it('does not retry a POST, which could double-submit a reward claim', async () => {
    let attempts = 0;
    mock.onPost('/api/wallet/withdraw').reply(() => { attempts++; return Promise.reject(new Error('Network Error')); });

    await expect(apiClient.post('/api/wallet/withdraw', { catalogItemId: 1 })).rejects.toBeTruthy();
    expect(attempts).toBe(1);
  });

  it('still reports offline when a POST fails, even though it is not retried', async () => {
    mock.onPost('/api/users/activity').networkError();
    await expect(apiClient.post('/api/users/activity', { screen: 'home' })).rejects.toBeTruthy();
    expect(mockStoreState.setOffline).toHaveBeenCalledWith(true);
  });
});

describe('api client — server responses are not treated as network failures', () => {
  beforeEach(() => {
    mock.reset();
    mockStoreState.setOffline.mockClear();
    mockStoreState.logout.mockClear();
    (Alert.alert as jest.Mock).mockClear();
  });

  it('does not retry or go offline on a 500 — the server answered', async () => {
    let attempts = 0;
    mock.onGet('/api/shorts').reply(() => { attempts++; return [500, { error: 'Something went wrong' }]; });

    await expect(apiClient.get('/api/shorts')).rejects.toBeTruthy();
    expect(attempts).toBe(1);
    expect(mockStoreState.setOffline).not.toHaveBeenCalledWith(true);
  });

  it('does not go offline on a 404', async () => {
    mock.onGet('/api/news').reply(404);
    await expect(apiClient.get('/api/news')).rejects.toBeTruthy();
    expect(mockStoreState.setOffline).not.toHaveBeenCalledWith(true);
  });

  it('logs the user out on a 401', async () => {
    mock.onGet('/api/users/profile').reply(401);
    await expect(apiClient.get('/api/users/profile')).rejects.toBeTruthy();
    expect(mockStoreState.logout).toHaveBeenCalled();
  });

  it('does not log the user out on a 403, which means "not allowed", not "signed out"', async () => {
    mock.onGet('/api/admin/error-logs').reply(403);
    await expect(apiClient.get('/api/admin/error-logs')).rejects.toBeTruthy();
    expect(mockStoreState.logout).not.toHaveBeenCalled();
  });

  it('surfaces rate limiting to the user rather than failing silently', async () => {
    mock.onGet('/api/shorts').reply(429);
    await expect(apiClient.get('/api/shorts')).rejects.toBeTruthy();
    expect(Alert.alert).toHaveBeenCalled();
  });
});

describe('api client — request cancellation', () => {
  beforeEach(() => {
    mock.reset();
    mockStoreState.setOffline.mockClear();
  });

  it('does not mark the app offline when a request is deliberately cancelled', async () => {
    // Screens abort in-flight requests on unmount; treating that as a network
    // failure would flash the offline screen during ordinary navigation.
    const controller = new AbortController();
    controller.abort();
    mock.onGet('/api/shorts').reply(200, { items: [] });

    await expect(apiClient.get('/api/shorts', { signal: controller.signal })).rejects.toBeTruthy();
    expect(mockStoreState.setOffline).not.toHaveBeenCalledWith(true);
  });

  it('reports a cancellation as a cancel, so callers can ignore it', async () => {
    const controller = new AbortController();
    controller.abort();
    mock.onGet('/api/news').reply(200, { items: [] });

    try {
      await apiClient.get('/api/news', { signal: controller.signal });
      throw new Error('should have rejected');
    } catch (err) {
      expect(axios.isCancel(err)).toBe(true);
    }
  });

  it('does not retry a cancelled request', async () => {
    const controller = new AbortController();
    controller.abort();
    mock.onGet('/api/shorts').reply(200, { items: [] });

    await expect(apiClient.get('/api/shorts', { signal: controller.signal })).rejects.toBeTruthy();
    expect(mock.history.get.length).toBeLessThanOrEqual(1);
  });
});
