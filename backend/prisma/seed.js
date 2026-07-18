"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const configs = [
        { key: 'shorts_ad_interval_min', value: '2' },
        { key: 'shorts_ad_interval_max', value: '4' },
        { key: 'rewarded_ad_interval_min', value: '6' },
        { key: 'rewarded_ad_interval_max', value: '8' },
        { key: 'daily_ad_cap', value: '20' },
        { key: 'discover_ad_interval_min', value: '3' },
        { key: 'discover_ad_interval_max', value: '6' },
        { key: 'short_watch_reward_coins', value: '10' },
        { key: 'short_watch_seconds_required', value: '8' },
        { key: 'streak_bonus_7', value: '100' },
        { key: 'streak_bonus_30', value: '500' },
        { key: 'offerwall_demo_mode', value: 'true' },
        { key: 'ad_activation_delay_ms', value: '5000' },
        { key: 'post_ad_lockout_ms', value: '1500' },
        { key: 'min_withdrawal_coins', value: '500' },
    ];
    for (const config of configs) {
        await prisma.appConfig.upsert({
            where: { key: config.key },
            update: { value: config.value },
            create: config,
        });
    }
    // Seed default RSS sources
    const rssSources = [
        { name: 'Times of India', url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms' },
        { name: 'The Hindu', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
    ];
    for (const source of rssSources) {
        await prisma.rssSource.upsert({
            where: { url: source.url },
            update: { name: source.name },
            create: source,
        });
    }
    console.log('Seed data inserted successfully.');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map