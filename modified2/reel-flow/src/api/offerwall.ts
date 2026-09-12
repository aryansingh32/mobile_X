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

// Real third-party offerwall network entry point — admin-configured
// (Economy Control → Offerwall Provider) separately from the self-hosted
// task catalog above. Returns enabled:false/url:null until an admin sets a
// wall URL and turns it on.
export const getOfferwallWall = async (deviceId?: string | null) => {
  const { data } = await apiClient.get('/api/webhooks/offerwall/wall', {
    params: deviceId ? { deviceId } : undefined,
  });
  return data as { enabled: boolean; url: string | null };
};
