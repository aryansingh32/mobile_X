import apiClient from './client';

export const loginWithGoogle = async (idToken: string) => {
  const { data } = await apiClient.post('/api/auth/google', { idToken });
  return data as { token: string; user: any };
};
