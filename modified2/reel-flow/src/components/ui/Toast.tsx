import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, Info, XCircle } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme';

type ToastKind = 'success' | 'error' | 'info';

type ToastState = {
  id: number;
  message: string | React.ReactNode;
  kind: ToastKind;
};

type ToastContextValue = {
  showToast: (message: string | React.ReactNode, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

/**
 * Use this instead of Alert.alert() for any non-destructive feedback
 * (task complete, bonus claimed, copied to clipboard, notification read).
 * Keep Alert.alert only for destructive confirmations (delete account, sign out)
 * that genuinely need a blocking native confirm.
 */
export const useToast = () => useContext(ToastContext);

const ICONS: Record<ToastKind, React.ComponentType<any>> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const ICON_COLORS: Record<ToastKind, string> = {
  success: COLORS.green,
  error: COLORS.red,
  info: COLORS.blue,
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -80, duration: 200, useNativeDriver: true, easing: Easing.in(Easing.cubic) }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [translateY, opacity]);

  const showToast = useCallback((message: string | React.ReactNode, kind: ToastKind = 'success') => {
    idRef.current += 1;
    setToast({ id: idRef.current, message, kind });
    translateY.setValue(-80);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(hide, 2500);
  }, [translateY, opacity, hide]);

  const Icon = toast ? ICONS[toast.kind] : null;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            { top: insets.top + SPACING.sm, transform: [{ translateY }], opacity },
          ]}
        >
          <View style={styles.card}>
            {Icon ? <Icon size={18} color={ICON_COLORS[toast.kind]} /> : null}
            <Text style={styles.text} numberOfLines={2}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    zIndex: 999,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.bg_elevated,
    borderWidth: 1,
    borderColor: COLORS.border_card,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  text: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    flexShrink: 1,
  },
});

export default ToastProvider;
