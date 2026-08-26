import { Gamepad2 } from 'lucide-react-native';
import { GAMES_METADATA, ICON_MAP } from './games_metadata';

export const GAME_ORIGIN = 'https://games-9up.pages.dev';

export type Game = {
  id: string;
  title: string;
  subtitle: string;
  path: string;
  thumbnail: string;
  accent: string;
  icon?: any; // lucide icon
};

export const gameUrl = (game: Game) => `${GAME_ORIGIN}/${game.path}/`;
export const thumbnailUrl = (game: Game) => game.thumbnail ? `${GAME_ORIGIN}/${game.thumbnail}` : '';

export const fetchGamesFromOrigin = async (): Promise<Game[]> => {
  const getMetadataList = (): Game[] => {
    return Object.keys(GAMES_METADATA).map(id => {
      const meta = GAMES_METADATA[id];
      return {
        id: meta.id,
        title: meta.title,
        subtitle: meta.subtitle,
        path: meta.path,
        thumbnail: meta.thumbnail,
        accent: meta.accent,
        icon: ICON_MAP[meta.iconName] || Gamepad2,
      };
    });
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(GAME_ORIGIN, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const html = await res.text();
    
    const games: Game[] = [];
    const regex = /<a href="([^"]+)\/">([^<]+)<\/a>/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const id = match[1];
      const titleText = match[2];
      
      const meta = GAMES_METADATA[id];
      
      games.push({
        id,
        title: meta?.title || (titleText.charAt(0).toUpperCase() + titleText.slice(1)),
        subtitle: meta?.subtitle || 'Arcade Game',
        path: id,
        thumbnail: meta?.thumbnail || '',
        accent: meta?.accent || '#FFD700',
        icon: meta ? (ICON_MAP[meta.iconName] || Gamepad2) : Gamepad2,
      });
    }
    
    // Sort games so those with thumbnails appear first
    games.sort((a, b) => {
      const aHasThumbnail = a.thumbnail ? 1 : 0;
      const bHasThumbnail = b.thumbnail ? 1 : 0;
      return bHasThumbnail - aHasThumbnail;
    });

    // If the fetched list is empty or very small, return all defined metadata games
    return games.length > 5 ? games : getMetadataList();
  } catch {
    // Silently fall back to metadata seed list
    return getMetadataList();
  }
};
