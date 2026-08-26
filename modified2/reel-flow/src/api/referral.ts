import apiClient from './client';

export const getReferralCode = async () => {
  const { data } = await apiClient.get('/api/referral/code');
  return data.data as { referralCode: string; shareLink: string };
};

export const getReferralStats = async () => {
  const { data } = await apiClient.get('/api/referral/stats');
  return data.data;
};

export const applyReferralCode = async (code: string) => {
  const { data } = await apiClient.post('/api/referral/apply', { code });
  return data;
};
