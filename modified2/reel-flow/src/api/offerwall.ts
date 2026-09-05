import apiClient from './client';

export interface OfferwallTask {
  id: number;
  title: string;
  description: string;
  imageUrl: string | null;
  rewardCoins: number;
  type: 'INSTALL' | 'SURVEY' | 'VIDEO' | 'SIGNUP' | 'REVIEW' | 'OTHER';
  externalUrl: string | null;
}

export const getOfferwallTasks = async () => {
  const { data } = await apiClient.get('/api/webhooks/offerwall/tasks');
  return data as { data: OfferwallTask[] };
};

export const completeTask = async (taskId: number) => {
  const { data } = await apiClient.post('/api/webhooks/offerwall/complete', { taskId });
  return data as { message: string; coinsEarned: number };
};
