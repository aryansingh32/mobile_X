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

    const MAX_ITEMS = 24;

    const organic: { id: string; text: string }[] = [];
    for (const w of withdrawals) {
      organic.push({ id: `w-${w.id}`, text: `${displayName(w.user.name)} withdrew ${w.amountCoins} VIB` });
    }
    for (const r of referrals) {
      organic.push({ id: `r-${r.id}`, text: `${displayName(r.referrer.name)} referred a friend` });
    }
    for (const b of badgesEarned) {
      organic.push({ id: `b-${b.id}`, text: `${displayName(b.user.name)} unlocked "${b.badge.name}"` });
    }

    const shuffle = <T,>(arr: T[]): T[] => {
      // Fisher-Yates. `sort(() => Math.random() - 0.5)` is not a uniform
      // shuffle — it biases toward the original order, so items near the end
      // were disproportionately likely to survive the slice below.
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      }
      return arr;
    };

    // Admin-authored messages get reserved slots. Previously everything was
    // pooled, shuffled, then sliced to 24 — so once organic activity exceeded
    // that (which it does on any active app), a message the admin deliberately
    // configured could be randomly dropped and never shown at all.
    const custom = customMessages
      .slice(0, MAX_ITEMS)
      .map((text, i) => ({ id: `c-${i}`, text }));
    const organicSlots = Math.max(0, MAX_ITEMS - custom.length);
    const items = shuffle([...custom, ...shuffle(organic).slice(0, organicSlots)]);

    res.json({ items });
  } catch (error: any) {
    sendServerError(res, error);
  }
};
