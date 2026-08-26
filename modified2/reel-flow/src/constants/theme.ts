export const COLORS = {
  bg_primary: '#0A0A0A',
  bg_card: '#161616',
  bg_elevated: '#1E1E1E',
  bg_input: '#252525',
  bg_sunken: '#050505',
  yellow: '#FFD700',
  yellow_dim: 'rgba(255,215,0,0.12)',
  orange: '#FF4D1A',
  orange_dim: 'rgba(255,77,26,0.12)',
  white: '#FFFFFF',
  white_80: 'rgba(255,255,255,0.80)',
  white_55: 'rgba(255,255,255,0.55)',
  white_30: 'rgba(255,255,255,0.30)',
  green: '#4CAF50',
  red: '#FF6B6B',
  blue: '#4A9EFF',
  border_subtle: 'rgba(255,255,255,0.07)',
  border_card: 'rgba(255,255,255,0.10)',
  border_active: 'rgba(255,215,0,0.35)',
  overlay_scrim: 'rgba(0,0,0,0.55)',
  success_dim: 'rgba(76,175,80,0.12)',
  danger_dim: 'rgba(255,107,107,0.12)',
  gradient_coin: ['#FFD700', '#FF8C00'] as const,
  gradient_hero: ['#1A1400', '#0A0A0A'] as const,
  gradient_reward: ['#1E1400', '#0A0A0A'] as const,
};

// Shared motion/timing tokens — use these instead of inlining durations so every
// screen's press/entrance/success animations feel like one system.
export const MOTION = {
  fast: 150,
  base: 250,
  slow: 400,
  spring_snappy: { tension: 120, friction: 10 },
  spring_soft: { tension: 60, friction: 8 },
  press_scale: 0.97,
};

export const TYPOGRAPHY = {
  hero: { fontSize: 48, fontWeight: '800' as const, letterSpacing: -1 },
  h1: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: '700' as const },
  h3: { fontSize: 15, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 21 },
  caption: { fontSize: 12, fontWeight: '500' as const },
  small: { fontSize: 11, fontWeight: '400' as const },
  reward: { fontSize: 16, fontWeight: '800' as const, color: '#FFD700' },
};

export const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
};

export const RADIUS = {
  sm: 8, md: 12, lg: 16, xl: 20, full: 999,
};

export const SHADOW = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  glow_yellow: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
};
