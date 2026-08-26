import apiClient from './client';
import DeviceInfo from 'react-native-device-info';

export const getProfile = async () => {
  const { data } = await apiClient.get('/api/users/profile');
  return data.data;
};

export const getBalance = async () => {
  const { data } = await apiClient.get('/api/users/profile');
  return data.data?.coins || 0;
};

export const getDailyMissions = async () => {
  const { data } = await apiClient.get('/api/users/missions/daily');
  return data.data;
};

export const syncStreak = async () => {
  const { data } = await apiClient.post('/api/users/streak/sync');
  return data.data;
};

export const updateFcmToken = async (fcmToken: string) => {
  await apiClient.put('/api/users/fcm-token', { fcmToken });
};

export const trackActivity = async (currentScreen: string) => {
  const { data } = await apiClient.post('/api/users/activity', { currentScreen });
  return data.data;
};

export const deleteAccount = async () => {
  const { data } = await apiClient.delete('/api/users/account', { data: { confirmation: 'DELETE' } });
  return data;
};

export const claimDailyBonus = async () => {
  const { data } = await apiClient.post('/api/users/daily-bonus');
  return data as { claimed: boolean; coinsEarned?: number; nextBonus?: string; message?: string };
};

export const claimDailyMissions = async () => {
  const { data } = await apiClient.post('/api/users/missions/daily/claim');
  return data as { claimed: boolean; coinsEarned?: number; nextBonus?: string; message?: string };
};

export const registerFingerprint = async () => {
  const hardwareId = await DeviceInfo.getUniqueId();
  const deviceModel = await DeviceInfo.getModel();
  const manufacturer = await DeviceInfo.getManufacturer();
  const osVersion = await DeviceInfo.getSystemVersion();
  const isEmulator = await DeviceInfo.isEmulator();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const playIntegrityToken = ''; // Replace with react-native-google-play-integrity getIntegrityToken()

    const aaid = await DeviceInfo.getAndroidId().catch(() => 'unknown');
    const isRooted = await DeviceInfo.isEmulator(); // Cannot easily detect root without native module
    const gsfId = 'unknown'; // Needs specific native module

    const { data } = await apiClient.post('/api/users/fingerprint', {
      hardwareId,
      deviceModel,
      manufacturer,
      osVersion,
      isEmulator,
      timezone,
      playIntegrityToken,
      aaid,
      gsfId,
      isRooted
    });
  return data;
};
