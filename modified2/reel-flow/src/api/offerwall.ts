import apiClient from './client';

export const getOfferwallTasks = async () => {
  const { data } = await apiClient.get('/api/webhooks/offerwall/tasks');
  return data as { data: any[]; demoMode: boolean };
};

export const completeTask = async (taskId: string) => {
  const { data } = await apiClient.post('/api/webhooks/offerwall/complete', { taskId });
  return data as { message: string; coinsEarned: number };
};
