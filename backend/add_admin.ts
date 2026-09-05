import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  const email = 'userlogin026@gmail.com';
  
  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    user = await prisma.user.update({
      where: { email },
      data: { role: 'SUPER_ADMIN' }
    });
    console.log(`Updated user ${email} to SUPER_ADMIN`);
  } else {
    user = await prisma.user.create({
      data: {
        email,
        name: 'Admin',
        role: 'SUPER_ADMIN',
        referralCode: 'RF' + uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase()
      }
    });
    console.log(`Created new user ${email} as SUPER_ADMIN`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
