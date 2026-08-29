import { registerRootComponent } from 'expo';

import App from './App';
import { installGlobalErrorHandlers } from './src/utils/crashReporter';

// Installed before the root component mounts so a crash during the very first
// render is still captured. Catches what React error boundaries cannot: JS
// exceptions thrown outside the render tree (timers, native callbacks).
installGlobalErrorHandlers();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
