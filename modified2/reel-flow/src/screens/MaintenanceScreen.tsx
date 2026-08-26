import React from 'react';
import { Wrench } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import StatusScreen from '../components/ui/StatusScreen';

/**
 * Shown when useConfigStore's maintenanceMode flag is true (see
 * useConfigStore.ts / defaultConfig.ts additions). No retry action — this is
 * a server-controlled state, not a client-side connectivity failure.
 */
export const MaintenanceScreen = () => {
  return (
    <StatusScreen
      icon={<Wrench color={COLORS.yellow} size={40} />}
      title="We'll Be Right Back!"
      subtitle="We are under maintenance. Please try again later."
    />
  );
};

export default MaintenanceScreen;
