import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.category.updateMany({ data: { isDiscoverFilter: false } });
  await prisma.rssSource.updateMany({ data: { isDiscoverFilter: false } });
  console.log('Done!');
}
main().then(() => process.exit(0));
