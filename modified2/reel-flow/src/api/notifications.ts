import apiClient from './client';

export interface AppNotification {
  id: number;
  title: string;
  body: string;
  type: string;
  read: boolean;
  sentAt: string;
}

export const getNotifications = async () => {
  const { data } = await apiClient.get('/api/users/notifications');
  return data.data as AppNotification[];
};

export const markNotificationRead = async (notificationId: number) => {
  await apiClient.put(`/api/users/notifications/${notificationId}/read`);
};
