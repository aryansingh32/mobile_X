import { createContext, useContext } from 'react';

// Default true: screens outside App.tsx's persisted tab system (Auth,
// Onboarding, pushed overlays like ProfileScreen/SettingsScreen) mount and
// unmount normally on navigation, so there's no "stuck animating in the
// background" risk for them — they should just animate whenever mounted.
const ScreenFocusContext = createContext(true);

export const ScreenFocusProvider = ScreenFocusContext.Provider;

// Whether the screen this component is rendered under is the one currently
// visible to the user. App.tsx's main tabs stay mounted forever (to avoid
// full remounts on tab switch), so components with a continuous animation —
// like VIBIcon — need this to know when they're sitting hidden in the
// background and should stop animating instead of burning CPU forever.
export const useScreenFocus = () => useContext(ScreenFocusContext);
