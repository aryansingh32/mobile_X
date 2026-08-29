/**
 * Query-param pagination parsing.
 *
 * `parseInt(x) || fallback` is not enough on its own: a negative number is
 * truthy, so `?limit=-5&offset=-10` sails through and reaches Prisma, which
 * rejects a negative take/skip and turns a malformed request into a 500.
 * An unbounded limit is the other half of the problem — `?limit=999999` on a
 * list endpoint asks the database for the entire table.
 */

export const parseLimit = (raw: unknown, fallback: number, max: number): number => {
  const parsed = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

export const parseOffset = (raw: unknown): number => {
  const parsed = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

/** Both at once, for the common `?limit=&offset=` pair. */
export const parsePagination = (
  query: { limit?: unknown; offset?: unknown },
  { fallback = 50, max = 200 }: { fallback?: number; max?: number } = {},
) => ({
  limit: parseLimit(query.limit, fallback, max),
  offset: parseOffset(query.offset),
});
