import { Router } from 'express';
import { getAllUsers, adjustUserBalance, updateUserMetrics, bulkUpdateUsers, getWithdrawals, processWithdrawal, getFraudLogs, resolveFraud, getSystemLogs, getMe } from '../controllers/adminController';
import { authenticate, authorizeAdmin, authorizeFinanceAdmin, authorizeFraudAnalyst, authorizeSuperAdmin } from '../middlewares/authMiddleware';
import {
  getAllConfig, updateConfig,
  getRssSources, createRssSource, updateRssSource, deleteRssSource,
  getYoutubePool, uploadYoutubePool, updateYoutubePoolItem, deleteYoutubePoolItem, importYoutubeSearch, getYoutubeImportLogs,
  getAdminCatalog, createCatalogItem, updateCatalogItem, deleteCatalogItem,
  getCatalogCodes, addCatalogCodes, updateCatalogCode, deleteCatalogCode,
  getAdminSuggestions, updateSuggestionStatus,
} from '../controllers/configController';

const router = Router();

router.use(authenticate, authorizeAdmin);

router.get('/me', getMe);

router.get('/users', authorizeFraudAnalyst, getAllUsers);
router.post('/users/:userId/balance', authorizeFinanceAdmin, adjustUserBalance);
router.post('/users/:userId/metrics', authorizeFraudAnalyst, updateUserMetrics);
router.post('/users/bulk-action', authorizeFraudAnalyst, bulkUpdateUsers);

router.get('/withdrawals', authorizeFinanceAdmin, getWithdrawals);
router.post('/withdrawals/:withdrawalId/process', authorizeFinanceAdmin, processWithdrawal);

router.get('/fraud', authorizeFraudAnalyst, getFraudLogs);
router.post('/fraud/:logId/resolve', authorizeFraudAnalyst, resolveFraud);

router.get('/logs', authorizeSuperAdmin, getSystemLogs);

// --- Google-Grade Advanced Endpoints ---
import { 
  getEnvConfig, getAuditLogs, getLiveUsers, 
  getUserIntelligence, getDashboardAnalytics, getRetentionData,
  getABTests, createABTest, updateABTest, sendNotification,
  getMissions, createMission, updateMission, deleteMission,
  getReferralAdmin
} from '../controllers/adminController';

router.get('/env', authorizeSuperAdmin, getEnvConfig);
router.get('/audit', authorizeSuperAdmin, getAuditLogs);
router.get('/live-users', authorizeFraudAnalyst, getLiveUsers);
router.get('/user-intelligence/:userId', authorizeFraudAnalyst, getUserIntelligence);
router.get('/analytics/dashboard', authorizeFinanceAdmin, getDashboardAnalytics);
router.get('/analytics/retention', authorizeSuperAdmin, getRetentionData);
router.get('/ab-tests', authorizeSuperAdmin, getABTests);
router.post('/ab-tests', authorizeSuperAdmin, createABTest);
router.put('/ab-tests/:testId', authorizeSuperAdmin, updateABTest);
router.post('/notifications/send', authorizeSuperAdmin, sendNotification);

// Missions
router.get('/missions', authorizeSuperAdmin, getMissions);
router.post('/missions', authorizeSuperAdmin, createMission);
router.put('/missions/:missionId', authorizeSuperAdmin, updateMission);
router.delete('/missions/:missionId', authorizeSuperAdmin, deleteMission);

// Referrals
router.get('/referrals', authorizeFinanceAdmin, getReferralAdmin);

// News & Categories System
import {
  getNewsDashboard, triggerFullSync, triggerSourceSync,
  getAdminNewsArticles, updateAdminNewsArticle, deleteAdminNewsArticle, getFeedSyncLogs,
  getCategories, createCategory, updateCategory, deleteCategory
} from '../controllers/configController';

router.get('/news/dashboard', authorizeSuperAdmin, getNewsDashboard);
router.post('/news/sync', authorizeSuperAdmin, triggerFullSync);
router.post('/news/sync/:sourceId', authorizeSuperAdmin, triggerSourceSync);
router.get('/news/articles', authorizeSuperAdmin, getAdminNewsArticles);
router.put('/news/articles/:id', authorizeSuperAdmin, updateAdminNewsArticle);
router.delete('/news/articles/:id', authorizeSuperAdmin, deleteAdminNewsArticle);
router.get('/news/sync-logs', authorizeSuperAdmin, getFeedSyncLogs);

router.get('/categories', authorizeSuperAdmin, getCategories);
router.post('/categories', authorizeSuperAdmin, createCategory);
router.put('/categories/:id', authorizeSuperAdmin, updateCategory);
router.delete('/categories/:id', authorizeSuperAdmin, deleteCategory);

// RSS Sources
router.get('/rss-sources', authorizeSuperAdmin, getRssSources);
router.post('/rss-sources', authorizeSuperAdmin, createRssSource);
router.put('/rss-sources/:id', authorizeSuperAdmin, updateRssSource);
router.delete('/rss-sources/:id', authorizeSuperAdmin, deleteRssSource);

// YouTube Video Pool
router.get('/youtube-pool', authorizeSuperAdmin, getYoutubePool);
router.post('/youtube-pool/upload', authorizeSuperAdmin, uploadYoutubePool);
router.post('/youtube-pool/search-import', authorizeSuperAdmin, importYoutubeSearch);
router.get('/youtube-pool/import-logs', authorizeSuperAdmin, getYoutubeImportLogs);
router.put('/youtube-pool/:id', authorizeSuperAdmin, updateYoutubePoolItem);
router.delete('/youtube-pool/:id', authorizeSuperAdmin, deleteYoutubePoolItem);

// App Config
router.get('/config', authorizeSuperAdmin, getAllConfig);
router.put('/config/:key', authorizeSuperAdmin, updateConfig);

// Catalog
router.get('/catalog', authorizeFinanceAdmin, getAdminCatalog);
router.post('/catalog', authorizeFinanceAdmin, createCatalogItem);
router.put('/catalog/:id', authorizeFinanceAdmin, updateCatalogItem);
router.delete('/catalog/:id', authorizeFinanceAdmin, deleteCatalogItem);
router.get('/catalog/:id/codes', authorizeFinanceAdmin, getCatalogCodes);
router.post('/catalog/:id/codes', authorizeFinanceAdmin, addCatalogCodes);
router.put('/catalog/codes/:codeId', authorizeFinanceAdmin, updateCatalogCode);
router.delete('/catalog/codes/:codeId', authorizeFinanceAdmin, deleteCatalogCode);

// Suggestions
router.get('/suggestions', authorizeSuperAdmin, getAdminSuggestions);
router.put('/suggestions/:id', authorizeSuperAdmin, updateSuggestionStatus);

// ─── Remote Config System (todo2.md) ───
import {
  getAdPlacements, createAdPlacement, updateAdPlacement, deleteAdPlacement,
  getAdRewardRules, updateAdRewardRule,
  getDailyCapPolicies, updateDailyCapPolicy,
  getContentStrings, updateContentString, bulkUpdateContentStrings,
  getFeatureFlags, updateFeatureFlag,
  getScreenSections, updateScreenSections,
  getAdFunnelAnalytics, getFillRateAnalytics, getRevenueEstimate,
} from '../controllers/remoteConfigAdminController';

// Ad Placements
router.get('/ad-placements', getAdPlacements);
router.post('/ad-placements/create', authorizeSuperAdmin, createAdPlacement);
router.put('/ad-placements/:id', authorizeSuperAdmin, updateAdPlacement);
router.delete('/ad-placements/:id', authorizeSuperAdmin, deleteAdPlacement);

// Ad Reward Rules
router.get('/ad-reward-rules', authorizeSuperAdmin, getAdRewardRules);
router.put('/ad-reward-rules/:adType', authorizeSuperAdmin, updateAdRewardRule);

// Daily Cap Policies
router.get('/daily-cap-policies', authorizeSuperAdmin, getDailyCapPolicies);
router.put('/daily-cap-policies/:tier', authorizeSuperAdmin, updateDailyCapPolicy);

// Content Strings (CMS)
router.get('/content-strings', authorizeSuperAdmin, getContentStrings);
router.put('/content-strings/:key', authorizeSuperAdmin, updateContentString);
router.post('/content-strings/bulk', authorizeSuperAdmin, bulkUpdateContentStrings);

// Feature Flags
router.get('/feature-flags', authorizeSuperAdmin, getFeatureFlags);
router.put('/feature-flags/:key', authorizeSuperAdmin, updateFeatureFlag);

// Screen Sections
router.get('/screen-sections/:screen', authorizeSuperAdmin, getScreenSections);
router.put('/screen-sections/:screen', authorizeSuperAdmin, updateScreenSections);

// Ad Analytics
router.get('/ad-analytics/funnel', getAdFunnelAnalytics);
router.get('/ad-analytics/fill-rate', getFillRateAnalytics);
router.get('/ad-analytics/revenue-estimate', getRevenueEstimate);

// Roulette
import {
  getRouletteItems, createRouletteItem, updateRouletteItem, deleteRouletteItem, getRouletteAnalytics
} from '../controllers/adminRouletteController';
router.get('/roulette', authorizeSuperAdmin, getRouletteItems);
router.post('/roulette', authorizeSuperAdmin, createRouletteItem);
router.put('/roulette/:id', authorizeSuperAdmin, updateRouletteItem);
router.delete('/roulette/:id', authorizeSuperAdmin, deleteRouletteItem);
router.get('/roulette/analytics', authorizeSuperAdmin, getRouletteAnalytics);

// Affiliate marketplace
import {
  getAdminAffiliateProducts, createAffiliateProduct, updateAffiliateProduct, deleteAffiliateProduct,
  getAdminAffiliateBanners, createAffiliateBanner, updateAffiliateBanner, deleteAffiliateBanner,
  getAffiliatePurchases, updateAffiliatePurchase, creditAffiliatePurchase,
} from '../controllers/affiliateAdminController';

router.get('/affiliate/products', authorizeFinanceAdmin, getAdminAffiliateProducts);
router.post('/affiliate/products', authorizeFinanceAdmin, createAffiliateProduct);
router.put('/affiliate/products/:id', authorizeFinanceAdmin, updateAffiliateProduct);
router.delete('/affiliate/products/:id', authorizeFinanceAdmin, deleteAffiliateProduct);

router.get('/affiliate/banners', authorizeFinanceAdmin, getAdminAffiliateBanners);
router.post('/affiliate/banners', authorizeFinanceAdmin, createAffiliateBanner);
router.put('/affiliate/banners/:id', authorizeFinanceAdmin, updateAffiliateBanner);
router.delete('/affiliate/banners/:id', authorizeFinanceAdmin, deleteAffiliateBanner);

router.get('/affiliate/purchases', authorizeFinanceAdmin, getAffiliatePurchases);
router.put('/affiliate/purchases/:id', authorizeFinanceAdmin, updateAffiliatePurchase);
router.post('/affiliate/purchases/:id/credit', authorizeFinanceAdmin, creditAffiliatePurchase);

export default router;
