import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      // Redirect to login or reload to let App.tsx handle it
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// Identity
export const getMe = () => api.get('/admin/me');

// Users & Intelligence
export const getUsers = () => api.get('/admin/users');
export const getUserIntelligence = (userId: number) => api.get(`/admin/user-intelligence/${userId}`);
export const adjustUserBalance = (userId: number, amount: number, reason?: string) => api.post(`/admin/users/${userId}/balance`, { amount, reason });
export const updateUserMetrics = (userId: number, metrics: any) => api.post(`/admin/users/${userId}/metrics`, metrics);
export const banUser = (userId: number) => api.post(`/admin/users/${userId}/metrics`, { banned: true });
export const shadowBanUser = (userId: number) => api.post(`/admin/users/${userId}/metrics`, { shadowBanned: true });
export const bulkUpdateUsers = (userIds: number[], action: 'ban' | 'unban' | 'shadowban' | 'unshadowban') =>
  api.post('/admin/users/bulk-action', { userIds, action });
export const getLiveUsers = () => api.get('/admin/live-users');

// Economy & Catalog
export const getWithdrawals = () => api.get('/admin/withdrawals');
export const processWithdrawal = (withdrawalId: number, status: string, options?: { voucherCode?: string, trackingId?: string, trackingStatus?: string }) => api.post(`/admin/withdrawals/${withdrawalId}/process`, { status, ...options });
export const getCatalog = () => api.get('/admin/catalog');
export const createCatalogItem = (data: any) => api.post('/admin/catalog', data);
export const updateCatalogItem = (id: number, data: any) => api.put(`/admin/catalog/${id}`, data);
export const deleteCatalogItem = (id: number) => api.delete(`/admin/catalog/${id}`);
export const getCatalogCodes = (catalogItemId: number) => api.get(`/admin/catalog/${catalogItemId}/codes`);
export const addCatalogCodes = (catalogItemId: number, codes: string) => api.post(`/admin/catalog/${catalogItemId}/codes`, { codes });
export const updateCatalogCode = (codeId: number, data: any) => api.put(`/admin/catalog/codes/${codeId}`, data);
export const deleteCatalogCode = (codeId: number) => api.delete(`/admin/catalog/codes/${codeId}`);

// Security & Fraud
export const getFraudLogs = () => api.get('/admin/fraud');
export const resolveFraud = (logId: number) => api.post(`/admin/fraud/${logId}/resolve`);
export const getSystemLogs = () => api.get('/admin/logs');
export const getAuditLogs = () => api.get('/admin/audit');

// Config & Env
export const getConfig = () => api.get('/admin/config');
export const updateConfig = (key: string, value: string) => api.put(`/admin/config/${key}`, { value });
export const getEnvConfig = () => api.get('/admin/env');
export const updateEnvConfig = (content: string) => api.post('/admin/env', { content });

// Content & Suggestions
export const getRssSources = () => api.get('/admin/rss-sources');
export const getYoutubePool = () => api.get('/admin/youtube-pool');
export const uploadYoutubePool = (videoIds: string[]) => api.post('/admin/youtube-pool/upload', { videoIds });
export const importYoutubeSearch = (data: { query: string; categoryId: number; count: number }) => api.post('/admin/youtube-pool/search-import', data);
export const getYoutubeImportLogs = () => api.get('/admin/youtube-pool/import-logs');
export const updateYoutubePoolItem = (id: number, data: any) => api.put(`/admin/youtube-pool/${id}`, data);
export const deleteYoutubePoolItem = (id: number) => api.delete(`/admin/youtube-pool/${id}`);
export const getSuggestions = () => api.get('/admin/suggestions');
export const updateSuggestionStatus = (id: number, status: string) => api.put(`/admin/suggestions/${id}`, { status });

// Analytics
export const getDashboardAnalytics = () => api.get('/admin/analytics/dashboard');
export const getRetentionData = () => api.get('/admin/analytics/retention');

// A/B Testing & Notifications
export const getABTests = () => api.get('/admin/ab-tests');
export const createABTest = (data: any) => api.post('/admin/ab-tests', data);
export const updateABTest = (id: number, data: any) => api.put(`/admin/ab-tests/${id}`, data);
export const sendNotification = (data: any) => api.post('/admin/notifications/send', data);

// Missions & Referrals
export const getMissions = () => api.get('/admin/missions');
export const createMission = (data: any) => api.post('/admin/missions', data);
export const updateMission = (id: number, data: any) => api.put(`/admin/missions/${id}`, data);
export const deleteMission = (id: number) => api.delete(`/admin/missions/${id}`);
export const getReferrals = () => api.get('/admin/referrals');

// News & Content Management
export const getNewsDashboard = () => api.get('/admin/news/dashboard');
export const syncNews = () => api.post('/admin/news/sync');
export const syncNewsSource = (sourceId: number) => api.post(`/admin/news/sync/${sourceId}`);
export const getNewsArticles = (params?: any) => api.get('/admin/news/articles', { params });
export const updateNewsArticle = (id: number, data: any) => api.put(`/admin/news/articles/${id}`, data);
export const deleteNewsArticle = (id: number) => api.delete(`/admin/news/articles/${id}`);
export const getNewsSyncLogs = () => api.get('/admin/news/sync-logs');

// Categories
export const getCategories = () => api.get('/admin/categories');
export const createCategory = (data: any) => api.post('/admin/categories', data);
export const updateCategory = (id: number, data: any) => api.put(`/admin/categories/${id}`, data);
export const deleteCategory = (id: number) => api.delete(`/admin/categories/${id}`);

// RSS Sources (CRUD)
export const createRssSource = (data: any) => api.post('/admin/rss-sources', data);
export const updateRssSource = (id: number, data: any) => api.put(`/admin/rss-sources/${id}`, data);
export const deleteRssSource = (id: number) => api.delete(`/admin/rss-sources/${id}`);

// ─── Remote Config System (Monetization Control) ───

// Ad Placements
export const getAdPlacements = () => api.get('/admin/ad-placements');
export const createAdPlacement = (data: any) => api.post('/admin/ad-placements/create', data);
export const updateAdPlacement = (id: number, data: any) => api.put(`/admin/ad-placements/${id}`, data);
export const deleteAdPlacement = (id: number) => api.delete(`/admin/ad-placements/${id}`);

// Ad Reward Rules
export const getAdRewardRules = () => api.get('/admin/ad-reward-rules');
export const updateAdRewardRule = (adType: string, data: any) => api.put(`/admin/ad-reward-rules/${adType}`, data);

// Daily Cap Policies
export const getDailyCapPolicies = () => api.get('/admin/daily-cap-policies');
export const updateDailyCapPolicy = (tier: string, data: any) => api.put(`/admin/daily-cap-policies/${tier}`, data);

// Content Strings (CMS)
export const getContentStrings = (screen?: string) => api.get('/admin/content-strings', { params: screen ? { screen } : {} });
export const updateContentString = (key: string, data: any) => api.put(`/admin/content-strings/${key}`, data);
export const bulkUpdateContentStrings = (strings: any[]) => api.post('/admin/content-strings/bulk', { strings });

// Feature Flags
export const getFeatureFlags = () => api.get('/admin/feature-flags');
export const updateFeatureFlag = (key: string, data: any) => api.put(`/admin/feature-flags/${key}`, data);

// Screen Sections
export const getScreenSections = (screen: string) => api.get(`/admin/screen-sections/${screen}`);
export const updateScreenSections = (screen: string, sections: any[]) => api.put(`/admin/screen-sections/${screen}`, { sections });

// Ad Analytics
export const getAdFunnelAnalytics = (days?: number, placementKey?: string) =>
  api.get('/admin/ad-analytics/funnel', { params: { days, placementKey } });
export const getFillRateAnalytics = (days?: number) =>
  api.get('/admin/ad-analytics/fill-rate', { params: { days } });
export const getRevenueEstimate = (days?: number) =>
  api.get('/admin/ad-analytics/revenue-estimate', { params: { days } });

// Roulette
export const getRouletteItems = () => api.get('/admin/roulette');
export const createRouletteItem = (data: any) => api.post('/admin/roulette', data);
export const updateRouletteItem = (id: number, data: any) => api.put(`/admin/roulette/${id}`, data);
export const deleteRouletteItem = (id: number) => api.delete(`/admin/roulette/${id}`);
export const getRouletteAnalytics = () => api.get('/admin/roulette/analytics');

// Affiliate marketplace
export const getAffiliateProducts = () => api.get('/admin/affiliate/products');
export const createAffiliateProduct = (data: any) => api.post('/admin/affiliate/products', data);
export const updateAffiliateProduct = (id: number, data: any) => api.put(`/admin/affiliate/products/${id}`, data);
export const deleteAffiliateProduct = (id: number) => api.delete(`/admin/affiliate/products/${id}`);

export const getAffiliateBanners = () => api.get('/admin/affiliate/banners');
export const createAffiliateBanner = (data: any) => api.post('/admin/affiliate/banners', data);
export const updateAffiliateBanner = (id: number, data: any) => api.put(`/admin/affiliate/banners/${id}`, data);
export const deleteAffiliateBanner = (id: number) => api.delete(`/admin/affiliate/banners/${id}`);

export const getAffiliatePurchases = (params?: { status?: string; userId?: number }) =>
  api.get('/admin/affiliate/purchases', { params });
export const updateAffiliatePurchase = (id: number, data: any) => api.put(`/admin/affiliate/purchases/${id}`, data);
export const creditAffiliatePurchase = (id: number) => api.post(`/admin/affiliate/purchases/${id}/credit`);

// Offerwall task catalog
export const getOfferwallTasks = () => api.get('/admin/offerwall/tasks');
export const createOfferwallTask = (data: any) => api.post('/admin/offerwall/tasks', data);
export const updateOfferwallTask = (id: number, data: any) => api.put(`/admin/offerwall/tasks/${id}`, data);
export const deleteOfferwallTask = (id: number) => api.delete(`/admin/offerwall/tasks/${id}`);
export const getOfferwallCompletions = (params?: { taskId?: number }) =>
  api.get('/admin/offerwall/completions', { params });
