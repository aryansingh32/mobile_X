/**
 * jest-expo pins the RN/Expo module mapping and transform config that a bare
 * jest setup gets wrong (Flow-typed RN internals, expo-* ESM packages).
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // node_modules ships untranspiled ESM/Flow for RN and the Expo/community
  // packages this app uses, so they must go through babel rather than be
  // ignored like ordinary deps.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-google-mobile-ads|@react-native-google-signin/.*|lucide-react-native)',
  ],
  // npm nests these under expo/ rather than hoisting them, but jest-expo's
  // preset resolves them from the project root.
  moduleNameMapper: {
    '^expo-modules-core(/.*)?$': '<rootDir>/node_modules/expo/node_modules/expo-modules-core$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/mocks/**',
  ],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}'],
};
