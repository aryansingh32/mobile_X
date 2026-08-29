import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorLogsPage from '../ErrorLogs';
import * as apiModule from '../../services/api';

vi.mock('../../services/api', () => ({ getErrorLogs: vi.fn() }));

const mockGetErrorLogs = apiModule.getErrorLogs as ReturnType<typeof vi.fn>;

const serverError = {
  id: 1, userId: 10, user: { id: 10, name: 'Asha', email: 'asha@example.com' },
  method: 'POST', path: '/api/wallet/withdraw', statusCode: 500,
  message: 'Insufficient balance check failed', stack: 'Error: at walletController.ts:88',
  createdAt: '2026-08-29T10:00:00.000Z', source: 'SERVER', platform: null, appVersion: null, fatal: false,
};

const clientCrash = {
  id: 2, userId: 11, user: { id: 11, name: 'Ravi', email: 'ravi@example.com' },
  method: 'CLIENT', path: 'shorts', statusCode: 0,
  message: "TypeError: Cannot read property 'id' of undefined",
  stack: 'TypeError: at ShortItem.tsx:120', createdAt: '2026-08-29T11:00:00.000Z',
  source: 'CLIENT', platform: 'android', appVersion: '1.1', fatal: true,
};

const anonymousError = {
  id: 3, userId: null, user: null, method: 'GET', path: '/api/config',
  statusCode: 503, message: 'Service unavailable', stack: null,
  createdAt: '2026-08-29T12:00:00.000Z', source: 'SERVER', platform: null, appVersion: null, fatal: false,
};

const respondWith = (data: unknown[], total = data.length) =>
  mockGetErrorLogs.mockResolvedValue({ data: { data, total, limit: 50, offset: 0 } });

beforeEach(() => {
  mockGetErrorLogs.mockReset();
  respondWith([serverError, clientCrash, anonymousError]);
});

/**
 * This page is where an operator triages real user-facing failures, and it is
 * the only place the technical detail exists — users only ever see a generic
 * message.
 */
describe('ErrorLogs page', () => {
  it('lists both server errors and app crashes', async () => {
    render(<ErrorLogsPage />);
    expect(await screen.findByText('Insufficient balance check failed')).toBeInTheDocument();
    expect(screen.getByText(/Cannot read property 'id' of undefined/)).toBeInTheDocument();
  });

  it('labels an app crash distinctly from an HTTP status', async () => {
    render(<ErrorLogsPage />);
    expect(await screen.findByText('CRASH')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('shows platform and app version for a device crash, which is what makes it triageable', async () => {
    render(<ErrorLogsPage />);
    expect(await screen.findByText(/android v1\.1 · shorts/)).toBeInTheDocument();
  });

  it('attributes each error to the user it happened to', async () => {
    render(<ErrorLogsPage />);
    expect(await screen.findByText(/Asha \(asha@example.com\) — #10/)).toBeInTheDocument();
  });

  it('marks an error with no user as unauthenticated rather than blank', async () => {
    render(<ErrorLogsPage />);
    expect(await screen.findByText('unauthenticated')).toBeInTheDocument();
  });

  it('keeps stack traces collapsed until an operator asks for one', async () => {
    render(<ErrorLogsPage />);
    await screen.findByText('Insufficient balance check failed');
    expect(screen.queryByText(/walletController\.ts:88/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Insufficient balance check failed'));
    expect(await screen.findByText(/walletController\.ts:88/)).toBeInTheDocument();
  });

  it('collapses an expanded stack trace again on a second click', async () => {
    render(<ErrorLogsPage />);
    await screen.findByText('Insufficient balance check failed');
    const row = screen.getByText('Insufficient balance check failed');

    await userEvent.click(row);
    expect(await screen.findByText(/walletController\.ts:88/)).toBeInTheDocument();
    await userEvent.click(row);
    await waitFor(() => expect(screen.queryByText(/walletController\.ts:88/)).not.toBeInTheDocument());
  });

  it('passes the source filter through to the API', async () => {
    render(<ErrorLogsPage />);
    await screen.findByText('Insufficient balance check failed');

    await userEvent.selectOptions(screen.getByDisplayValue('All sources'), 'CLIENT');
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));

    await waitFor(() => {
      expect(mockGetErrorLogs).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'CLIENT' }));
    });
  });

  it('passes a search term and user id through to the API', async () => {
    render(<ErrorLogsPage />);
    await screen.findByText('Insufficient balance check failed');

    await userEvent.type(screen.getByPlaceholderText('Search message or path...'), 'balance');
    await userEvent.type(screen.getByPlaceholderText('User ID'), '10');
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));

    await waitFor(() => {
      expect(mockGetErrorLogs).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'balance', userId: '10' }));
    });
  });

  it('shows an explicit empty state rather than a blank panel', async () => {
    respondWith([]);
    render(<ErrorLogsPage />);
    expect(await screen.findByText(/No errors recorded/)).toBeInTheDocument();
  });

  it('does not crash the panel when the API call fails', async () => {
    mockGetErrorLogs.mockRejectedValue(new Error('network down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorLogsPage />);
    expect(await screen.findByText(/No errors recorded/)).toBeInTheDocument();
  });

  it('hides pagination when everything fits on one page', async () => {
    respondWith([serverError], 1);
    render(<ErrorLogsPage />);
    await screen.findByText('Insufficient balance check failed');
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('paginates when there are more results than one page', async () => {
    respondWith([serverError], 120);
    render(<ErrorLogsPage />);
    await screen.findByText('Insufficient balance check failed');

    const next = screen.getByRole('button', { name: 'Next' });
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await userEvent.click(next);
    await waitFor(() => {
      expect(mockGetErrorLogs).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 50 }));
    });
  });
});
