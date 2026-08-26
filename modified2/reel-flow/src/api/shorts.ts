import apiClient from './client';

export const fetchShorts = async (cursor?: number, limit: number = 10, excludeIds: string[] = []) => {
  const params: any = { limit };
  if (cursor !== undefined) params.cursor = cursor;
  // Pass seen video IDs so backend can exclude them (avoids reshowing watched content)
  if (excludeIds.length > 0) params.excludeIds = excludeIds.join(',');
  const { data } = await apiClient.get('/api/shorts', { params });
  return data as { data: any[]; nextCursor: number | null };
};

export const fetchTrendingShorts = async (limit: number = 10) => {
  const { data } = await apiClient.get('/api/shorts/trending', { params: { limit } });
  return data as { data: any[] };
};
