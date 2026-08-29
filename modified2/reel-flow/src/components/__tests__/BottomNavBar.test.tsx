import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import BottomNavBar from '../BottomNavBar';

jest.mock('../../utils/haptics', () => ({ triggerHaptic: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

/**
 * The tab bar is the app's primary navigation. Its selected state is drawn by
 * a floating circle rendered outside the tab row, so without explicit
 * accessibility state a screen reader announces five identical tabs with no
 * way to tell which one is current.
 */
describe('BottomNavBar accessibility', () => {
  it('exposes every tab to assistive technology by name', () => {
    render(<BottomNavBar activeTab="home" />);
    for (const label of ['Home', 'Discover', 'Hot', 'Earn', 'Wallet']) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('marks the active tab as selected', () => {
    render(<BottomNavBar activeTab="wallet" />);
    expect(screen.getByLabelText('Wallet').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('Home').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('moves the selected state when the active tab changes', () => {
    const { rerender } = render(<BottomNavBar activeTab="home" />);
    expect(screen.getByLabelText('Home').props.accessibilityState).toMatchObject({ selected: true });

    rerender(<BottomNavBar activeTab="discover" />);
    expect(screen.getByLabelText('Discover').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('Home').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('announces each tab with the tab role', () => {
    render(<BottomNavBar activeTab="home" />);
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });

  it('reports the tapped tab to the caller', () => {
    const onTabChange = jest.fn();
    render(<BottomNavBar activeTab="home" onTabChange={onTabChange} />);

    fireEvent.press(screen.getByLabelText('Wallet'));
    expect(onTabChange).toHaveBeenCalledWith('wallet');
  });

  it('does not crash when no handler is supplied', () => {
    render(<BottomNavBar activeTab="home" />);
    expect(() => fireEvent.press(screen.getByLabelText('Hot'))).not.toThrow();
  });
});
