import { useShallow } from 'zustand/react/shallow';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal, Image } from 'react-native';
import { VIBIcon } from '../ui/VIBIcon';
import { useAppStore } from '../../store/useAppStore';

interface TabTooltipProps {
  tab: string;
  onDismiss: () => void;
}

const TOOLTIP_CONTENT: Record<string, { title: string; body: React.ReactNode }> = {
  discover: {
    title: 'Swipe to Discover & Earn',
    body: 'Scroll through news. Reward videos appear as you browse.',
  },
  hot: {
    title: 'Watch Shorts',
    body: <View style={{flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap'}}><Text style={{color: '#FFF'}}>Watch shorts. Earn </Text><VIBIcon size={14} style={{ marginHorizontal: 2 }} /><Text style={{color: '#FFF'}}> by watching sponsored reward videos.</Text></View>,
  },
  rewards: {
    title: 'Complete Tasks for Big Rewards',
    body: <View style={{flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap'}}><Text style={{color: '#FFF'}}>Finish tasks from our partners to earn up to 500 </Text><VIBIcon size={14} style={{ marginHorizontal: 2 }} /><Text style={{color: '#FFF'}}> per task. More tasks unlock as you level up.</Text></View>,
  },
  wallet: {
    title: 'Your Earnings, Your Choice',
    body: <View style={{flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap'}}><Text style={{color: '#FFF'}}>Redeem your </Text><VIBIcon size={14} style={{ marginHorizontal: 2 }} /><Text style={{color: '#FFF'}}> for UPI cash, gift vouchers, or merchandise. Minimum withdrawal is 500 </Text><VIBIcon size={14} style={{ marginHorizontal: 2 }} /><Text style={{color: '#FFF'}}>.</Text></View>,
  },
  home: {
    title: 'Your Earnings Hub',
    body: <View style={{flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap'}}><Text style={{color: '#FFF'}}>Track your streak, missions, and total earnings here. Complete daily missions for bonus XP and </Text><VIBIcon size={14} style={{ marginHorizontal: 2 }} /><Text style={{color: '#FFF'}}>.</Text></View>,
  },
};

export const TabTooltip: React.FC<TabTooltipProps> = ({ tab, onDismiss }) => {
  const { hasSeenTabTooltip, markTabSeen } = useAppStore(useShallow(s => ({ hasSeenTabTooltip: s.hasSeenTabTooltip, markTabSeen: s.markTabSeen })));
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!hasSeenTabTooltip[tab] && TOOLTIP_CONTENT[tab]) {
      const timer = setTimeout(() => {
        setVisible(true);
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [tab, hasSeenTabTooltip]);

  const handleDismiss = () => {
    markTabSeen(tab);
    setVisible(false);
    onDismiss();
  };

  if (!visible || !TOOLTIP_CONTENT[tab]) return null;

  return (
    <Modal transparent animationType="none" visible={visible}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={handleDismiss} />
        
        <Animated.View style={[
          styles.tooltipBubble,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}>
          <Text style={styles.title}>{TOOLTIP_CONTENT[tab].title}</Text>
          {typeof TOOLTIP_CONTENT[tab].body === 'string' ? (
            <Text style={styles.body}>{TOOLTIP_CONTENT[tab].body}</Text>
          ) : (
            <View style={styles.bodyContainer}>
              <Text style={styles.body}>{TOOLTIP_CONTENT[tab].body}</Text>
            </View>
          )}
          
          <TouchableOpacity style={styles.button} onPress={handleDismiss}>
            <Text style={styles.buttonText}>Got it →</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 100, // Above bottom nav
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  tooltipBubble: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    width: '85%',
    borderWidth: 1,
    borderColor: '#FFD700',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bodyContainer: {
    marginBottom: 16,
  },
  body: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#FFD700',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
});
