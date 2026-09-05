import apiClient from './client';

export const getCatalog = async () => {
  const { data } = await apiClient.get('/api/wallet/catalog');
  return data.data;
};

export const requestWithdrawal = async (payload: { catalogItemId: number; destinationId?: string; size?: string; color?: string; deliveryAddress?: string; mobileNumber?: string; requestId?: string }) => {
  const { data } = await apiClient.post('/api/wallet/withdraw', payload);
  return data;
};

export const getHistory = async (cursor?: number) => {
  const params: any = {};
  if (cursor) params.cursor = cursor;
  const { data } = await apiClient.get('/api/wallet/history', { params });
  return data as { data: any[]; nextCursor: number | null };
};

export const getMyWithdrawals = async (cursor?: number) => {
  const params: any = {};
  if (cursor) params.cursor = cursor;
  const { data } = await apiClient.get('/api/wallet/withdrawals', { params });
  return data as { data: any[]; nextCursor: number | null };
};

export const getSuggestions = async () => {
  const { data } = await apiClient.get('/api/wallet/suggest');
  return data.data;
};

export const postSuggestion = async (message: string) => {
  const { data } = await apiClient.post('/api/wallet/suggest', { message });
  return data;
};
