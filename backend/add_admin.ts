import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'userlogin026@gmail.com';
  
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: 'SUPER_ADMIN',
    },
    create: {
      email,
      name: 'Admin',
      role: 'SUPER_ADMIN',
      trustScore: 100,
    },
  });

  console.log('Successfully added/updated super admin:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
