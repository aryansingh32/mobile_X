import apiClient from './client';

export interface MarqueeItem {
  id: string;
  text: string;
  imageUrl?: string;
}

/**
 * Fetches dynamic marquee content (testimonials, recent activities) 
 * which can be managed via the admin panel.
 */
export const fetchMarqueeItems = async (): Promise<MarqueeItem[]> => {
  try {
    const { data, status } = await apiClient.get('/api/marquee', { timeout: 10000 });
    if (status === 200 && data?.items) {
      return data.items;
    }
    return [];
  } catch (error) {
    // Fail silently and return empty array to fallback to default/cached items
    return [];
  }
};
