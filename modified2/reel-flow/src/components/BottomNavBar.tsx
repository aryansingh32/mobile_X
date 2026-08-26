import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerHaptic } from '../utils/haptics';

const { width } = Dimensions.get('window');

// ─── FEATURE FLAGS ─────────────────────────────────────────────────────────
const ENABLE_GLASS_BLUR = true;
const ENABLE_FLAME_COLOR = true;
// ───────────────────────────────────────────────────────────────────────────

// ─── DESIGN TOKENS ─────────────────────────────────────────────────────────
export const NAV_TOKENS = {
  navBg: '#1A1A1A',
  navBorder: 'rgba(255,255,255,0.06)',
  activePillBg: '#2A2A2A',
  activePillBorder: 'rgba(255,255,255,0.12)',
  glassBg: 'rgba(255,255,255,0.08)',
  glassBorder: 'rgba(255,255,255,0.14)',
  iconInactive: 'rgba(255,255,255,0.45)',
  iconActive: '#FFFFFF',
  flameColor: '#FF4D1A',
  labelFontSize: 12,
  labelInactive: 'rgba(255,255,255,0.45)',
  labelActive: '#FFFFFF',
  pillHeight: 72,
  pillRadius: 24,
  pillPaddingH: 6,
  navMarginH: 12,
} as const;

export type TabId = 'home' | 'discover' | 'hot' | 'rewards' | 'wallet';

const HomeIcon = ({ active, color }: { active: boolean; color?: string }) => (
  <Svg color={color} width="24" height="24" viewBox={active ? "0 0 24 24" : "0 0 20 20"} fill="none">
    {active ? (
      <>
        <Path d="M3 11.9895V14.4999C3 17.7997 3 19.4496 4.02513 20.4748C5.05025 21.4999 6.70017 21.4999 10 21.4999H14C17.2998 21.4999 18.9497 21.4999 19.9749 20.4748C21 19.4496 21 17.7997 21 14.4999V11.9895C21 10.3082 21 9.46764 20.6441 8.73996C20.2882 8.01228 19.6247 7.49619 18.2976 6.46402L16.2976 4.90846C14.2331 3.30276 13.2009 2.49991 12 2.49991C10.7991 2.49991 9.76689 3.30276 7.70242 4.90846L5.70241 6.46402C4.37533 7.49619 3.71179 8.01228 3.3559 8.73996C3 9.46764 3 10.3082 3 11.9895Z" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M15 17.0001C14.2005 17.6225 13.1502 18.0001 12 18.0001C10.8497 18.0001 9.79953 17.6225 9 17.0001" stroke={NAV_TOKENS.navBg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </>
    ) : (
      <>
        <Path d="M2.5 9.9913V12.0833C2.5 14.8331 2.5 16.208 3.35427 17.0624C4.20854 17.9166 5.58347 17.9166 8.33333 17.9166H11.6667C14.4165 17.9166 15.7914 17.9166 16.6457 17.0624C17.5 16.208 17.5 14.8331 17.5 12.0833V9.9913C17.5 8.59021 17.5 7.88974 17.2034 7.28334C16.9068 6.67694 16.3539 6.24686 15.248 5.38672L13.5813 4.09042C11.8609 2.75234 11.0007 2.0833 10 2.0833C8.99925 2.0833 8.13908 2.75234 6.41868 4.09042L4.75201 5.38672C3.64611 6.24686 3.09316 6.67694 2.79658 7.28334C2.5 7.88974 2.5 8.59021 2.5 9.9913Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M12.5 14.1667C11.8338 14.6854 10.9585 15 10 15C9.04143 15 8.16628 14.6854 7.5 14.1667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </>
    )}
  </Svg>
);

const DiscoverIcon = ({ active, color }: { active: boolean; color?: string }) => (
  <Svg color={color} width="24" height="24" viewBox="0 0 24 24" fill="none">
    {active ? (
      <>
        <Circle cx="12" cy="12" r="10" fill="currentColor" />
        <Path d="M16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill={NAV_TOKENS.navBg} />
      </>
    ) : (
      <>
        <Circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
        <Path d="M16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </>
    )}
  </Svg>
);

const FlameIcon = ({ active, flameColor, color }: { active: boolean; flameColor: boolean; color?: string }) => {
  const fill = active && flameColor ? NAV_TOKENS.flameColor : (active ? 'currentColor' : 'none');
  const stroke = active && flameColor ? NAV_TOKENS.flameColor : 'currentColor';
  return (
    <Svg color={color} width="24" height="24" viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={active ? '0' : '1.8'} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Svg>
  );
};

const EarnIcon = ({ active, color }: { active: boolean; color?: string }) => (
  <Svg color={color} width="24" height="24" viewBox="0 0 24 24" fill="none">
    {active ? (
      <>
        <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinejoin="round" />
        <Circle cx="12" cy="12" r="4" stroke={NAV_TOKENS.navBg} strokeWidth="1.5" />
      </>
    ) : (
      <>
        <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <Circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      </>
    )}
  </Svg>
);

const WalletIcon = ({ active, color }: { active: boolean; color?: string }) => (
  <Svg color={color} width="24" height="24" viewBox="0 0 24 24" fill="none">
    {active ? (
      <>
        <Rect x="2" y="5" width="20" height="14" rx="3" fill="currentColor" />
        <Path d="M2 10h20" stroke={NAV_TOKENS.navBg} strokeWidth="1.5" />
        <Path d="M16 15h2" stroke={NAV_TOKENS.navBg} strokeWidth="1.5" strokeLinecap="round" />
      </>
    ) : (
      <>
        <Rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <Path d="M2 10h20" stroke="currentColor" strokeWidth="1.5" />
        <Path d="M16 15h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </>
    )}
  </Svg>
);

const TABS = [
  { id: 'home', label: 'Home', icon: (active: boolean, color: string) => <HomeIcon active={active} color={color} /> },
  { id: 'discover', label: 'Discover', icon: (active: boolean, color: string) => <DiscoverIcon active={active} color={color} /> },
  { id: 'hot', label: 'Hot', icon: (active: boolean, color: string) => <FlameIcon active={active} flameColor={ENABLE_FLAME_COLOR} color={color} /> },
  { id: 'rewards', label: 'Earn', icon: (active: boolean, color: string) => <EarnIcon active={active} color={color} /> },
  { id: 'wallet', label: 'Wallet', icon: (active: boolean, color: string) => <WalletIcon active={active} color={color} /> },
] as const;

interface BottomNavBarProps {
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
  style?: any;
}

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab = 'home', onTabChange, style }) => {
  const insets = useSafeAreaInsets();
  const [animValue] = React.useState(new Animated.Value(0));
  const activePulse = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const tabIndex = TABS.findIndex(t => t.id === activeTab);
    Animated.spring(animValue, {
      toValue: Math.max(0, tabIndex),
      useNativeDriver: true,
      tension: 60,
      friction: 7,
    }).start();
    activePulse.setValue(1);
    Animated.sequence([
      Animated.timing(activePulse, { toValue: 1.3, duration: 120, useNativeDriver: true }),
      Animated.timing(activePulse, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  }, [activeTab]);

  const TAB_BAR_WIDTH = Math.min(width - NAV_TOKENS.navMarginH * 2, 400);
  const TAB_WIDTH = TAB_BAR_WIDTH / 5;

  const translateX = animValue.interpolate({
    inputRange: [0, 4],
    outputRange: [
      0 * TAB_WIDTH + TAB_WIDTH / 2 - 1040,
      4 * TAB_WIDTH + TAB_WIDTH / 2 - 1040,
    ]
  });

  const circleTranslateX = animValue.interpolate({
    inputRange: [0, 4],
    outputRange: [
      0 * TAB_WIDTH,
      4 * TAB_WIDTH,
    ]
  });

  const activeTabIndex = Math.max(0, TABS.findIndex(t => t.id === activeTab));
  const activeTabConfig = TABS[activeTabIndex] || TABS[0];
  const isHotAndActive = activeTabConfig.id === 'hot' && ENABLE_FLAME_COLOR;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom || 12 }, style]} pointerEvents="box-none">
      <View style={{ width: TAB_BAR_WIDTH, height: NAV_TOKENS.pillHeight }}>
        <View style={styles.pill}>
          <AnimatedSvg style={{ position: 'absolute', top: 0, left: 0, transform: [{ translateX }] }} width={2080} height={NAV_TOKENS.pillHeight}>
            <Path fill={NAV_TOKENS.navBg} d="M 0 1 L 990 1 C 1015 1, 1010 39, 1040 39 C 1070 39, 1065 1, 1090 1 L 2080 1 L 2080 80 L 0 80 Z" />
          </AnimatedSvg>

          <View style={styles.tabsRow}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={styles.tab}
                  activeOpacity={0.7}
                  onPress={() => {
                    triggerHaptic('selection', 'haptics_navigation');
                    onTabChange?.(tab.id);
                  }}
                >
                  <View style={[styles.iconContainerInactive, { opacity: isActive ? 0 : 1 }]}>
                    {tab.icon(false, NAV_TOKENS.iconInactive)}
                  </View>
                  <Text style={isActive ? styles.labelActive : styles.labelInactive}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Animated.View style={[styles.floatingCircleContainer, { width: TAB_WIDTH, transform: [{ translateX: circleTranslateX }, { scale: activePulse }] }]} pointerEvents="none">
          <View style={styles.floatingCircle}>
            {activeTabConfig.icon(true, isHotAndActive ? NAV_TOKENS.flameColor : NAV_TOKENS.iconActive)}
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pill: {
    flex: 1,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderColor: NAV_TOKENS.navBorder,
    borderRadius: NAV_TOKENS.pillRadius,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 10,
  },
  tabsRow: {
    flexDirection: 'row',
    flex: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  floatingCircleContainer: {
    position: 'absolute',
    top: -24,
    height: 56,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 10,
  },
  floatingCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: NAV_TOKENS.navBg,
    borderWidth: 0,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerInactive: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  labelActive: {
    fontSize: NAV_TOKENS.labelFontSize,
    fontWeight: '600',
    color: NAV_TOKENS.labelActive,
  },
  labelInactive: {
    fontSize: NAV_TOKENS.labelFontSize,
    fontWeight: '500',
    color: NAV_TOKENS.labelInactive,
  },
});

export default BottomNavBar;
