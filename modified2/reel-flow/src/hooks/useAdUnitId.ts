import { Platform } from 'react-native';
import { useConfigStore } from '../store/useConfigStore';

export const useAdUnitId = (adUnitKey: string, testAdUnitId: string): string | null => {
  const unit = useConfigStore((state) => state.adUnits[adUnitKey]);

  if (__DEV__) {
    return testAdUnitId;
  }

  if (Platform.OS === 'android') {
    return unit?.android ?? null;
  }

  if (Platform.OS === 'ios') {
    return unit?.ios ?? null;
  }

  return null;
};
