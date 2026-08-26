/**
 * Generates a unique, rich dark color from any string (title, id, etc.)
 * Uses HSL color space so every article gets a visually distinct hue.
 */
export const getCardColor = (uniqueString: string): string => {
  let hash = 0;
  for (let i = 0; i < uniqueString.length; i++) {
    hash = uniqueString.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Use the hash to pick a hue (0-360), keep saturation rich, lightness low for dark premium look
  const hue = Math.abs(hash) % 360;
  const saturation = 30 + (Math.abs(hash >> 8) % 25); // 30-55%
  const lightness = 18 + (Math.abs(hash >> 16) % 12);  // 18-30%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const AD_COLORS = [
  '#1A1A2E', '#16213E', '#0F3460', '#1B1A2C',
  '#2C1654', '#1A3C34', '#3C1A1A', '#1A2A3C',
];

export const getRandomAdColor = () => {
  return AD_COLORS[Math.floor(Math.random() * AD_COLORS.length)];
};
