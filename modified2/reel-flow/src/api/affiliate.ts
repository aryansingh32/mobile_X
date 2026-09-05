import apiClient from './client';

export interface AffiliateProduct {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string;
  price: number;
  vibReward: number;
  affiliateUrl: string;
  platform: string;
  category: string;
  section: 'FEATURED' | 'TRENDING' | 'DEALS' | 'GENERAL';
  sortOrder: number;
}

export interface AffiliateBanner {
  id: number;
  imageUrl: string;
  linkType: 'PRODUCT' | 'CATEGORY' | 'URL';
  linkValue: string;
  sortOrder: number;
}

export const getAffiliateProducts = async (): Promise<AffiliateProduct[]> => {
  const { data } = await apiClient.get('/api/affiliate/products');
  return data.data || [];
};

export const getAffiliateBanners = async (): Promise<AffiliateBanner[]> => {
  const { data } = await apiClient.get('/api/affiliate/banners');
  return data.data || [];
};

export const trackAffiliateClick = async (productId: number): Promise<{ affiliateUrl: string }> => {
  const { data } = await apiClient.post('/api/affiliate/click', { productId });
  return data.data;
};
