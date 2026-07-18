const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.category.updateMany({ data: { isDiscoverFilter: false } });
  await prisma.rssSource.updateMany({ data: { isDiscoverFilter: false } });
  console.log('Filters disabled successfully!');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
