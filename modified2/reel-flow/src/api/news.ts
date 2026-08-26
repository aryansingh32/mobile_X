import apiClient from './client';

export const fetchNews = async (cursor?: number, limit: number = 20, category?: string, source?: string) => {
  const params: any = { limit };
  if (cursor !== undefined) params.cursor = cursor;
  if (category) params.category = category;
  if (source) params.source = source;
  const { data } = await apiClient.get('/api/news', { params });
  return data as { data: any[]; nextCursor: number | null };
};

export const fetchNewsFilters = async () => {
  const { data } = await apiClient.get('/api/news/filters');
  return data as { categories: { name: string; imageUrl?: string }[]; sources: { name: string; imageUrl?: string }[] };
};

export const fetchNewsById = async (id: string) => {
  const { data } = await apiClient.get(`/api/news/${id}`);
  return data;
};
