import { describe, it, expect, beforeEach, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { api, getErrorLogs, getUserIntelligence, updateConfig, processWithdrawal } from '../api';

/**
 * The admin panel's single axios instance carries two behaviors that every
 * page depends on: it attaches the stored bearer token, and it force-signs-out
 * on a 401. A regression in either locks operators out of the panel or, worse,
 * silently sends unauthenticated writes.
 */

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(api);
});

describe('api client — auth token handling', () => {
  it('attaches the stored admin token as a bearer header', async () => {
    localStorage.setItem('adminToken', 'admin-jwt-123');
    mock.onGet('/admin/users').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer admin-jwt-123');
      return [200, { data: [] }];
    });
    await api.get('/admin/users');
  });

  it('sends no Authorization header when not signed in', async () => {
    mock.onGet('/admin/users').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200, { data: [] }];
    });
    await api.get('/admin/users');
  });

  it('picks up a token stored after the module was imported', async () => {
    // The interceptor must read localStorage per-request, not once at import,
    // or the first login would send unauthenticated requests until reload.
    localStorage.setItem('adminToken', 'fresh-token');
    mock.onGet('/admin/me').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer fresh-token');
      return [200, {}];
    });
    await api.get('/admin/me');
  });
});

describe('api client — 401 handling', () => {
  it('clears stored credentials on a 401 so a stale session cannot linger', async () => {
    localStorage.setItem('adminToken', 'expired-token');
    localStorage.setItem('adminUser', JSON.stringify({ id: 1 }));
    mock.onGet('/admin/users').reply(401, { error: 'Unauthorized' });

    await expect(api.get('/admin/users')).rejects.toBeTruthy();

    expect(localStorage.getItem('adminToken')).toBeNull();
    expect(localStorage.getItem('adminUser')).toBeNull();
    // ...and bounces the operator back to the login screen.
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('does not sign the admin out on a 403, which means "wrong role", not "logged out"', async () => {
    localStorage.setItem('adminToken', 'valid-token');
    mock.onGet('/admin/env').reply(403, { error: 'Forbidden' });

    await expect(api.get('/admin/env')).rejects.toBeTruthy();

    expect(localStorage.getItem('adminToken')).toBe('valid-token');
  });

  it('does not sign the admin out on a server error', async () => {
    localStorage.setItem('adminToken', 'valid-token');
    mock.onGet('/admin/users').reply(500, { error: 'Something went wrong' });

    await expect(api.get('/admin/users')).rejects.toBeTruthy();

    expect(localStorage.getItem('adminToken')).toBe('valid-token');
  });

  it('does not sign the admin out on a network failure', async () => {
    localStorage.setItem('adminToken', 'valid-token');
    mock.onGet('/admin/users').networkError();

    await expect(api.get('/admin/users')).rejects.toBeTruthy();

    expect(localStorage.getItem('adminToken')).toBe('valid-token');
  });

  it('rejects the promise on 401 rather than resolving, so callers do not treat it as success', async () => {
    mock.onGet('/admin/users').reply(401);
    await expect(api.get('/admin/users')).rejects.toBeTruthy();
  });
});

describe('api service methods — request shape', () => {
  it('getErrorLogs forwards filters as query params', async () => {
    mock.onGet('/admin/error-logs').reply((config) => {
      expect(config.params).toMatchObject({ source: 'CLIENT', statusCode: '500', limit: 50, offset: 0 });
      return [200, { data: [], total: 0 }];
    });
    await getErrorLogs({ source: 'CLIENT', statusCode: '500', limit: 50, offset: 0 });
  });

  it('getErrorLogs omits undefined filters instead of sending empty values', async () => {
    mock.onGet('/admin/error-logs').reply((config) => {
      expect(config.params?.search).toBeUndefined();
      expect(config.params?.userId).toBeUndefined();
      return [200, { data: [], total: 0 }];
    });
    await getErrorLogs({ search: undefined, userId: undefined, limit: 50, offset: 0 });
  });

  it('getUserIntelligence targets the requested user', async () => {
    mock.onGet('/admin/user-intelligence/42').reply(200, { data: { id: 42 } });
    const res = await getUserIntelligence(42);
    expect(res.data.data.id).toBe(42);
  });

  it('updateConfig sends the value in the body, not the URL', async () => {
    mock.onPut('/admin/config/reward_coins').reply((config) => {
      expect(JSON.parse(config.data)).toEqual({ value: '25' });
      return [200, {}];
    });
    await updateConfig('reward_coins', '25');
  });

  it('processWithdrawal merges optional fulfillment fields into the payload', async () => {
    mock.onPost('/admin/withdrawals/7/process').reply((config) => {
      expect(JSON.parse(config.data)).toEqual({ status: 'APPROVED', voucherCode: 'ABC-123' });
      return [200, {}];
    });
    await processWithdrawal(7, 'APPROVED', { voucherCode: 'ABC-123' });
  });

  it('processWithdrawal sends only status when no options are supplied', async () => {
    mock.onPost('/admin/withdrawals/7/process').reply((config) => {
      expect(JSON.parse(config.data)).toEqual({ status: 'REJECTED' });
      return [200, {}];
    });
    await processWithdrawal(7, 'REJECTED');
  });
});
