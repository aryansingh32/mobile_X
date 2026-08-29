import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import { sendServerError } from '../utils/errorResponse';

// First name + last initial — enough to feel like a real person without
// exposing a full name to every other user.
const displayName = (fullName: string): string => {
  const parts = (fullName || 'A user').trim().split(/\s+/).filter(Boolean);
  const first = parts[0] || 'A user';
  const lastInitial = parts.length > 1 ? ` ${parts[parts.length - 1]![0]}.` : '';
  return `${first}${lastInitial}`;
};

// The client's AutoMarquee component has always called this endpoint —
// it just never existed on the backend, so every "someone just withdrew
// 1000 VIB" chip shown to users was a hardcoded fallback string, never a
// real event. This builds the feed from real, recent, anonymized activity;
// the client already falls back to its hardcoded chips if this returns an
// empty list (e.g. a fresh deployment with no activity yet).
// Admin-authored lines (promos, announcements, "we hit 10k users!") — kept
// separate from real activity so the feed is never ONLY marketing copy, but
// can carry it. Stored as a plain JSON string array under one AppConfig key
// so this needed no schema change; managed from the admin panel's
// Social-Proof Feed page.
const getCustomMarqueeMessages = async (): Promise<string[]> => {
  const config = await prisma.appConfig.findUnique({ where: { key: 'marquee_custom_messages' } });
  if (!config?.value) return [];
  try {
    const parsed = JSON.parse(config.value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m): m is string => typeof m === 'string' && m.trim().length > 0);
  } catch {
    return [];
  }
};

export const getMarquee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [withdrawals, referrals, badgesEarned, customMessages] = await Promise.all([
      prisma.withdrawal.findMany({
        where: { status: { in: ['APPROVED', 'SHIPPED', 'DELIVERED'] }, processedAt: { gte: since } },
        orderBy: { processedAt: 'desc' },
        take: 15,
        include: { user: { select: { name: true } } },
      }),
      prisma.referral.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { referrer: { select: { name: true } } },
      }),
      prisma.userBadges.findMany({
        where: { earnedAt: { gte: since } },
        orderBy: { earnedAt: 'desc' },
        take: 15,
        include: { user: { select: { name: true } }, badge: { select: { name: true } } },
      }),
      getCustomMarqueeMessages(),
    ]);

    const items: { id: string; text: string }[] = [];
    for (const w of withdrawals) {
      items.push({ id: `w-${w.id}`, text: `${displayName(w.user.name)} withdrew ${w.amountCoins} VIB` });
    }
    for (const r of referrals) {
      items.push({ id: `r-${r.id}`, text: `${displayName(r.referrer.name)} referred a friend` });
    }
    for (const b of badgesEarned) {
      items.push({ id: `b-${b.id}`, text: `${displayName(b.user.name)} unlocked "${b.badge.name}"` });
    }
    customMessages.forEach((text, i) => items.push({ id: `c-${i}`, text }));

    // Interleave categories instead of running them in three separate blocks.
    items.sort(() => Math.random() - 0.5);

    res.json({ items: items.slice(0, 24) });
  } catch (error: any) {
    sendServerError(res, error);
  }
};
