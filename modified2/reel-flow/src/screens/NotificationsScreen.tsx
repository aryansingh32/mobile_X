import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bell, Gift, ShoppingBag, Users, CheckCircle2 } from 'lucide-react-native';
import { AppNotification, getNotifications, markNotificationRead } from '../api/notifications';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import EmptyState from '../components/ui/EmptyState';
import { Shimmer } from '../components/ui/Shimmer';

type FilterKey = 'all' | 'offers' | 'rewards' | 'system';

const FILTERS: { key: FilterKey; label: string; types: string[] }[] = [
  { key: 'all', label: 'All', types: [] },
  { key: 'offers', label: 'Offers', types: ['OFFER', 'OFFERWALL'] },
  { key: 'rewards', label: 'Rewards', types: ['REWARD', 'BONUS', 'REFERRAL', 'MISSION'] },
  { key: 'system', label: 'System', types: ['SYSTEM', 'WITHDRAWAL', 'WELCOME'] },
];

const ICON_BY_TYPE: Record<string, React.ComponentType<any>> = {
  OFFER: ShoppingBag,
  OFFERWALL: ShoppingBag,
  REWARD: Gift,
  BONUS: Gift,
  MISSION: CheckCircle2,
  REFERRAL: Users,
  SYSTEM: Bell,
  WITHDRAWAL: CheckCircle2,
  WELCOME: Gift,
};

export const NotificationsScreen = ({ onBack }: { onBack: () => void }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Shared by the initial mount fetch and "Tap to retry" — previously the
  // retry button only did setLoading(true) with nothing to actually
  // re-trigger the fetch, so any failure left the user permanently stuck
  // on the shimmer with no way to recover.
  const fetchNotifs = useCallback(() => {
    setLoading(true);
    setError('');
    getNotifications()
      .then((data) => { if (mountedRef.current) setNotifications(data); })
      .catch(() => { if (mountedRef.current) setError('Failed to load notifications'); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
  }, []);

  useEffect(() => {
    fetchNotifs();
  }, [fetchNotifs]);

  const readNotification = (notification: AppNotification) => {
    if (notification.read) return;
    setNotifications((current) => current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)));
    markNotificationRead(notification.id).catch(() => {});
  };

  const activeFilter = FILTERS.find((f) => f.key === filter)!;
  const visible = activeFilter.types.length === 0
    ? notifications
    : notifications.filter((n) => activeFilter.types.includes(n.type));

  return (
    <View style={styles.root}>
      <ScreenHeader title="Notifications" onBack={onBack} />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressedDim]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Pressable
          style={({ pressed }) => [styles.errorCard, pressed && styles.pressedDim]}
          onPress={fetchNotifs}
        >
          <Text style={styles.errorText}>{error}. Tap to retry.</Text>
        </Pressable>
      ) : null}

      {loading ? (
        <View style={styles.content}>
          {[0, 1, 2].map((i) => (
            <Shimmer key={i} width="100%" height={72} borderRadius={16} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Bell size={28} color={COLORS.white_55} />}
          title="No notifications yet"
          subtitle="Offers, rewards, and updates will show up here."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {visible.map((notification) => {
            const Icon = ICON_BY_TYPE[notification.type] || Bell;
            return (
              <Pressable
                key={notification.id}
                style={({ pressed }) => [styles.card, !notification.read && styles.cardUnread, pressed && styles.pressedDim]}
                onPress={() => readNotification(notification)}
              >
                <View style={styles.iconCircle}>
                  <Icon size={18} color={COLORS.yellow} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{notification.title}</Text>
                  <Text style={styles.cardText} numberOfLines={2}>{notification.body}</Text>
                  <Text style={styles.cardTime}>{new Date(notification.sentAt).toLocaleString()}</Text>
                </View>
                {!notification.read ? <View style={styles.unreadDot} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg_primary },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  filterChip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bg_input,
  },
  filterChipActive: { backgroundColor: COLORS.yellow },
  filterText: { ...TYPOGRAPHY.caption, color: COLORS.white_80, fontWeight: '700' },
  filterTextActive: { color: '#111111' },
  content: { padding: SPACING.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.bg_card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border_card,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  errorCard: {
    backgroundColor: 'rgba(255,77,26,0.12)',
    borderColor: '#FF4D1A',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  errorText: {
    color: '#FFF',
    textAlign: 'center',
    fontSize: 12,
  },
  cardUnread: { borderColor: COLORS.border_active },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.yellow_dim,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  cardBody: { flex: 1 },
  cardTitle: { ...TYPOGRAPHY.h3, color: COLORS.white },
  cardText: { ...TYPOGRAPHY.caption, color: COLORS.white_55, marginTop: 2 },
  cardTime: { ...TYPOGRAPHY.caption, color: COLORS.white_30, marginTop: 6, fontSize: 11 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.yellow, marginLeft: SPACING.sm, marginTop: 6 },
  pressedDim: { opacity: 0.75 },
});

export default NotificationsScreen;
