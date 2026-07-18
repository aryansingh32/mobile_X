import cron from 'node-cron';
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import prisma from '../config/db';

type CustomItem = { media?: any, content?: string };
const parser = new Parser<any, CustomItem>({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['content:encoded', 'contentEncoded']
    ],
  }
});

// Helper to fetch OG Image via cheerio
const fetchOgImage = async (url: string): Promise<string | null> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    
    return $('meta[property="og:image"]').attr('content') ||
           $('meta[name="twitter:image"]').attr('content') ||
           null;
  } catch (error: any) {
    if (error.name === 'AbortError') return null;
    console.error(`Failed to scrape OG image for ${url}:`, error.message || error);
    return null;
  }
};

export const syncSingleSource = async (sourceId: number) => {
  const source = await prisma.rssSource.findUnique({ where: { id: sourceId } });
  if (!source || !source.active) return null;

  const log = await prisma.feedSyncLog.create({
    data: { sourceId, status: 'STARTED' }
  });

  const startTime = Date.now();
  let articlesFetched = 0;
  let articlesNew = 0;
  let imagesFetched = 0;
  let imagesFailed = 0;
  let status = 'SUCCESS';
  let errorMsg = null;

  try {
    const feed = await parser.parseURL(source.url);
    articlesFetched = feed.items.length;

    for (const item of feed.items) {
      if (!item.link) continue;

      const externalId = crypto.createHash('md5').update(item.link).digest('hex');
      
      const existing = await prisma.newsArticle.findUnique({ where: { externalId } });
      if (existing) continue;

      let imageUrl: string | null = null;
      if (item.media && item.media.$ && item.media.$.url) {
        imageUrl = item.media.$.url;
      } else if ((item as any).contentEncoded) {
        const imgMatch = (item as any).contentEncoded.match(/<img[^>]+src="([^">]+)"/);
        if (imgMatch) imageUrl = imgMatch[1];
      }

      if (!imageUrl) {
        imageUrl = await fetchOgImage(item.link);
        if (imageUrl) imagesFetched++;
        else imagesFailed++;
      } else {
        imagesFetched++;
      }

      try {
        const result = await prisma.newsArticle.createMany({
          data: [{
            externalId,
            title: (item.title || 'Untitled').slice(0, 190),
            description: item.contentSnippet || item.content,
            imageUrl,
            sourceUrl: item.link,
            sourceName: feed.title || source.name,
            sourceId: source.id,
            categoryId: source.categoryId,
            publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          }],
          skipDuplicates: true
        });
        if (result.count > 0) articlesNew++;
      } catch (articleErr: any) {
        console.error(`Failed to create article: ${externalId}`, articleErr.message || articleErr);
      }
    }
  } catch (err: any) {
    status = 'FAILED';
    errorMsg = err.message;
  }

  const durationMs = Date.now() - startTime;
  
  await prisma.feedSyncLog.update({
    where: { id: log.id },
    data: {
      status: errorMsg ? 'FAILED' : (imagesFailed > 0 ? 'PARTIAL' : 'SUCCESS'),
      articlesFetched,
      articlesNew,
      imagesFetched,
      imagesFailed,
      error: errorMsg,
      durationMs,
      completedAt: new Date()
    }
  });

  await prisma.rssSource.update({
    where: { id: source.id },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: status,
      lastError: errorMsg,
      articleCount: { increment: articlesNew }
    }
  });

  return { articlesFetched, articlesNew, status };
};

export const runIngestionNow = async () => {
  const sources = await prisma.rssSource.findMany({ where: { active: true } });
  for (const source of sources) {
    await syncSingleSource(source.id);
  }
};

const cleanupOldArticles = async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  await prisma.newsArticle.deleteMany({
    where: { publishedAt: { lt: thirtyDaysAgo } }
  });
};

export const startNewsIngestion = () => {
  // Run on startup
  runIngestionNow().catch(console.error);

  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running scheduled news ingestion...');
    await runIngestionNow();
    await cleanupOldArticles();
  });
};
