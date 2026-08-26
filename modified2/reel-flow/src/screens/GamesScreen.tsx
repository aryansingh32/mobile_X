import { useShallow } from 'zustand/react/shallow';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useAppStore } from '../store/useAppStore';
import { Game } from '../api/games';
import { GamePlayerOverlay } from '../components/ui/GamePlayerOverlay';
import { GameGridCard } from '../components/ui/GameGridCard';

export const GamesScreen = ({ onBack }: { onBack: () => void }) => {
  const insets = useSafeAreaInsets();
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const { games, trackEvent } = useAppStore(useShallow(s => ({ games: s.games, trackEvent: s.trackEvent })));
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    let mounted = true;
    if (games.length > 0) {
      setLoading(false);
    } else {
      setTimeout(() => { if (mounted) setLoading(false); }, 1500);
    }
    return () => { mounted = false; };
  }, [games]);

  return (
    <View style={styles.root}>
      <GamePlayerOverlay 
        selectedGame={selectedGame} 
        onExit={() => setSelectedGame(null)} 
      />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.iconButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to home">
          <ArrowLeft color="#FFF" size={22} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Arcade</Text>
          <Text style={styles.title}>All Games ({games.length})</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.grid}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <View key={`shimmer-${i}`} style={styles.shimmerCard} />
            ))}
          </View>
        ) : games.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No games available right now.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {games.map((game: any) => (
              <GameGridCard 
                key={game.id} 
                game={game} 
                onPress={() => {
                  trackEvent('GAMES_PLAYED', 1);
                  setSelectedGame(game);
                }} 
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#1A1A1A',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    marginLeft: 12,
  },
  kicker: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  shimmerCard: {
    width: '48%',
    aspectRatio: 0.8,
    backgroundColor: '#222',
    borderRadius: 16,
    marginBottom: 16,
  },
});
