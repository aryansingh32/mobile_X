/**
 * seedBadges.ts
 *
 * Seeds the initial badge catalog. The Badges/UserBadges tables and the
 * getProfile() read path already existed — nothing ever wrote to them, and
 * there was no catalog to award from. checkAndAwardBadges() (see
 * services/badgeService.ts) is the write path; this script is the catalog.
 *
 * Run with: npx ts-node src/scripts/seedBadges.ts
 * Safe to re-run: matches existing rows by name.
 */
import prisma from '../config/db';

const BADGES: Array<{
  name: string;
  description: string;
  conditionType: string;
  conditionValue: number;
  imageUrl?: string;
}> = [
  {
    name: 'Week Warrior',
    description: 'Kept a 7-day streak alive.',
    conditionType: 'STREAK',
    conditionValue: 7,
  },
  {
    name: 'Month Master',
    description: 'Kept a 30-day streak alive.',
    conditionType: 'STREAK',
    conditionValue: 30,
  },
  {
    name: 'Unstoppable',
    description: 'Kept a 100-day streak alive.',
    conditionType: 'STREAK',
    conditionValue: 100,
  },
  {
    name: 'Max Level',
    description: 'Reached Level 10.',
    conditionType: 'LEVEL',
    conditionValue: 10,
  },
  {
    name: 'Binge Watcher',
    description: 'Watched 100 shorts.',
    conditionType: 'SHORTS_WATCHED',
    conditionValue: 100,
  },
  {
    name: 'First Payout',
    description: 'Completed your first withdrawal.',
    conditionType: 'WITHDRAWAL',
    conditionValue: 1,
  },
  {
    name: 'Recruiter',
    description: 'Referred your first friend.',
    conditionType: 'REFERRALS',
    conditionValue: 1,
  },
];

async function main() {
  for (const badge of BADGES) {
    const existing = await prisma.badges.findFirst({ where: { name: badge.name } });
    if (existing) {
      await prisma.badges.update({ where: { id: existing.id }, data: badge });
    } else {
      await prisma.badges.create({ data: badge });
    }
    console.log(`Seeded badge: ${badge.name}`);
  }
  console.log(`Done — ${BADGES.length} badge(s) seeded.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
