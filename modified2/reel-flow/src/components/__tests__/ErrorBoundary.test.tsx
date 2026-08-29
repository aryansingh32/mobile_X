import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ErrorBoundary } from '../ErrorBoundary';
import { reportError } from '../../utils/crashReporter';

jest.mock('../../utils/crashReporter', () => ({ reportError: jest.fn() }));

const mockReportError = reportError as jest.Mock;

const Boom = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error('render exploded');
  return <Text>recovered content</Text>;
};

/**
 * The ErrorBoundary is the app's last line of defense: without it an uncaught
 * render exception white-screens the entire app with no recovery path.
 */
describe('ErrorBoundary', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockReportError.mockClear();
    // React logs caught render errors to console.error regardless; silence it
    // so a passing test doesn't look like a failing one.
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => consoleErrorSpy.mockRestore());

  it('renders children normally when nothing throws', () => {
    render(<ErrorBoundary><Text>happy path</Text></ErrorBoundary>);
    expect(screen.getByText('happy path')).toBeTruthy();
  });

  it('shows a recovery UI instead of a white screen when a child throws', () => {
    render(<ErrorBoundary><Boom shouldThrow /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Try Again')).toBeTruthy();
  });

  it('never shows the raw error message to the user', () => {
    render(<ErrorBoundary><Boom shouldThrow /></ErrorBoundary>);
    expect(screen.queryByText(/render exploded/)).toBeNull();
  });

  it('reports the crash so it reaches the admin panel rather than dying silently', () => {
    render(<ErrorBoundary><Boom shouldThrow /></ErrorBoundary>);
    expect(mockReportError).toHaveBeenCalledTimes(1);
    const [error, options] = mockReportError.mock.calls[0];
    expect(error.message).toBe('render exploded');
    expect(options).toMatchObject({ fatal: true, context: 'render' });
  });

  it('recovers when the user taps Try Again and the child no longer throws', () => {
    const { rerender } = render(<ErrorBoundary><Boom shouldThrow /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeTruthy();

    rerender(<ErrorBoundary><Boom shouldThrow={false} /></ErrorBoundary>);
    fireEvent.press(screen.getByText('Try Again'));

    expect(screen.getByText('recovered content')).toBeTruthy();
  });
});
