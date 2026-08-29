/* eslint-disable no-undef */

// Native modules with no JS implementation under Jest. Each is mocked at the
// boundary the app actually uses, so tests exercise real app logic rather than
// a reimplementation of it.

jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: {
    isEmulator: jest.fn().mockResolvedValue(false),
    getUniqueId: jest.fn().mockResolvedValue('test-device-id'),
    getSystemVersion: jest.fn().mockReturnValue('14'),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
    revokeAccess: jest.fn().mockResolvedValue(undefined),
  },
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED', IN_PROGRESS: 'IN_PROGRESS' },
}));

// The app already ships a mock for this (used on platforms without the native
// ad module); reuse it rather than maintaining a second one.
jest.mock('react-native-google-mobile-ads', () =>
  require('./src/mocks/react-native-google-mobile-ads'),
);

// Silence the RN animation helper's noisy "useNativeDriver is not supported"
// warning in the test environment.
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), { virtual: true });

// `__DEV__` gates dev-only logging in app code (e.g. crashReporter). Default it
// off so tests assert production behavior unless a test opts in.
global.__DEV__ = false;
