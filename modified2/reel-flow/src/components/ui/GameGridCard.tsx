import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Gamepad2 } from 'lucide-react-native';
import { Shimmer } from './Shimmer';
import { Game, thumbnailUrl } from '../../api/games';
import { COLORS, RADIUS, TYPOGRAPHY } from '../../constants/theme';

const windowWidth = Dimensions.get('window').width;
const cardWidth = (windowWidth - 48) / 2; // 2 columns with 16 padding on sides and 16 gap

type Props = {
  game: Game;
  // Takes the game itself so every card in a list can share one stable
  // `onPress` reference from the parent (see HomeScreen/GamesScreen) —
  // required for this component's React.memo below to actually skip
  // re-renders instead of seeing a "new" prop every time.
  onPress: (game: Game) => void;
};

const GameGridCardImpl = ({ game, onPress }: Props) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const Icon = game.icon || Gamepad2;
  const url = thumbnailUrl(game);

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]} onPress={() => onPress(game)}>
      <View style={styles.imageContainer}>
        {url ? (
          <>
            <Image
              source={{ uri: url }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
              priority="low"
              onLoad={() => setImageLoaded(true)}
            />
            <LinearGradient colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.85)']} style={styles.overlay}>
              <View style={[styles.iconBadge, { backgroundColor: game.accent }]}>
                <Icon color="#111" size={16} />
              </View>
            </LinearGradient>
            {!imageLoaded && <Shimmer style={StyleSheet.absoluteFillObject} />}
          </>
        ) : (
          <View style={[styles.image, { backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' }]}>
            <Icon color={game.accent || '#FFF'} size={42} opacity={0.5} />
            <LinearGradient colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.85)']} style={styles.overlay}>
              <View style={[styles.iconBadge, { backgroundColor: game.accent }]}>
                <Icon color="#111" size={16} />
              </View>
            </LinearGradient>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{game.title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{game.subtitle}</Text>
        <View style={styles.playButton}>
          <Text style={styles.playButtonText}>PLAY</Text>
        </View>
      </View>
    </Pressable>
  );
};

// Rendered up to ~90 at a time (Games tab) — skip re-rendering cards whose
// `game`/`onPress` haven't changed when an unrelated list re-render happens.
export const GameGridCard = React.memo(GameGridCardImpl);

const styles = StyleSheet.create({
  card: {
    width: cardWidth,
    marginBottom: 16,
    backgroundColor: '#161616',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  imageContainer: {
    width: '100%',
    height: 110,
    backgroundColor: '#222',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 8,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    padding: 12,
  },
  title: {
    color: COLORS.white,
    ...TYPOGRAPHY.body,
    fontWeight: '800',
    marginBottom: 2,
  },
  subtitle: {
    color: COLORS.white_55,
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    marginBottom: 10,
  },
  playButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  playButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
