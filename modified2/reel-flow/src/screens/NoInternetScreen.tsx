import React from 'react';
import { WifiOff } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import StatusScreen from '../components/ui/StatusScreen';

/**
 * Full-screen connectivity error — shown when the whole app can't reach the
 * network (distinct from the inline "Tap to retry" error cards used when a
 * single section's fetch fails but the rest of the UI still renders, e.g.
 * HomeScreen/WalletScreen/RewardsScreen's `error` state). Keep both patterns.
 */
export const NoInternetScreen = ({ onRetry }: { onRetry: () => void }) => {
  return (
    <StatusScreen
      icon={<WifiOff color={COLORS.yellow} size={40} />}
      title="No Internet Connection"
      subtitle="Please check your internet connection and try again."
      actionLabel="Try Again"
      onActionPress={onRetry}
    />
  );
};

export default NoInternetScreen;
