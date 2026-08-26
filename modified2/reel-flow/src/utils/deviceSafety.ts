import DeviceInfo from 'react-native-device-info';

export const isRealDevice = async (): Promise<boolean> => {
  const isEmulator = await DeviceInfo.isEmulator();
  return !isEmulator;
};

export const getDeviceId = async (): Promise<string> => {
  return await DeviceInfo.getUniqueId();
};
