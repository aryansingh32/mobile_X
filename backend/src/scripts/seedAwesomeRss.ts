import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const REPO_PATH = '/home/unknown/Desktop/mobile_X/awesome-rss-feeds';

async function processOpmlFile(filePath: string, categoryName: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(content, { xmlMode: true });

    let category = await prisma.category.findFirst({ where: { name: categoryName } });
    
    if (!category) {
      category = await prisma.category.create({
        data: {
          name: categoryName,
          active: true,
          sortOrder: 0,
          isDiscoverFilter: true
        }
      });
      console.log(`Created Category: ${categoryName}`);
    }

    const outlines = $('outline[xmlUrl]');
    let addedCount = 0;

    outlines.each((_, el) => {
      const xmlUrl = $(el).attr('xmlUrl');
      const title = $(el).attr('title') || $(el).attr('text');

      if (xmlUrl && title) {
        // Upsert into RssSource
        prisma.rssSource.upsert({
          where: { url: xmlUrl },
          update: {
            name: title,
            categoryId: category!.id,
            isDiscoverFilter: true
          },
          create: {
            name: title,
            url: xmlUrl,
            categoryId: category!.id,
            active: true, // You can set this to false if you don't want them active immediately
            isDiscoverFilter: true,
            sortOrder: 0
          }
        }).then(() => {
          addedCount++;
        }).catch(err => {
          console.error(`Failed to upsert ${xmlUrl}:`, err.message);
        });
      }
    });

    console.log(`Processed ${outlines.length} sources for category: ${categoryName}`);

  } catch (err: any) {
    console.error(`Error processing ${filePath}:`, err.message);
  }
}

async function main() {
  console.log('Starting RSS Seed Script...');

  const directoriesToScan = [
    path.join(REPO_PATH, 'recommended', 'without_category'),
    path.join(REPO_PATH, 'countries', 'without_category')
  ];

  for (const dir of directoriesToScan) {
    if (!fs.existsSync(dir)) {
      console.warn(`Directory not found: ${dir}`);
      continue;
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.opml'));
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      // Derive category name from file name (e.g., "Android Development.opml" -> "Android Development")
      const categoryName = path.basename(file, '.opml');
      await processOpmlFile(filePath, categoryName);
    }
  }

  // Wait a bit for all the async upserts to finish (fire-and-forget loops)
  // A better approach is Promise.all, but this keeps memory usage manageable.
  setTimeout(async () => {
    console.log('Finished seeding process. Disconnecting DB...');
    await prisma.$disconnect();
  }, 5000);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
