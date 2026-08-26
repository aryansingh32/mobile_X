const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add custom resolver to handle EventEmitter path and mock google mobile ads on web
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native/Libraries/vendor/emitter/EventEmitter') {
    return {
      type: 'sourceFile',
      filePath: require.resolve('./src/mocks/EventEmitter.ts'),
    };
  }
  if (platform === 'web' && moduleName === 'react-native-google-mobile-ads') {
    return {
      type: 'sourceFile',
      filePath: require.resolve('./src/mocks/react-native-google-mobile-ads.tsx'),
    };
  }
  
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
