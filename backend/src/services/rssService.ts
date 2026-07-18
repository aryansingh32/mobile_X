import prisma from '../config/db';

export const fetchNewsFromDb = async (cursor?: number, limit: number = 20, category?: string, source?: string) => {
  const where: any = {
    isHidden: false,
    OR: [
      { categoryId: null },
      { category: { active: true } }
    ]
  };
  
  if (category) {
    where.category = { name: category, active: true };
    delete where.OR; // Override OR when specific category requested
  }
  
  if (source) {
    where.sourceName = source;
  }
  
  const offset = cursor || 0;

  const articles = await prisma.newsArticle.findMany({
    where,
    orderBy: [
      { isPinned: 'desc' },
      { isFeatured: 'desc' },
      { publishedAt: 'desc' },
    ],
    skip: offset,
    take: limit,
    select: {
      id: true,
      externalId: true,
      title: true,
      description: true,
      imageUrl: true,
      sourceUrl: true,
      sourceName: true,
      categoryId: true,
      category: { select: { name: true } },
      publishedAt: true,
      isFeatured: true,
      isPinned: true,
    },
  });

  // Shuffle non-pinned non-featured articles within the batch
  // This ensures varied ordering each session while keeping editorial priority items fixed.
  const pinned = articles.filter(a => a.isPinned);
  const featured = articles.filter(a => !a.isPinned && a.isFeatured);
  const regular = articles.filter(a => !a.isPinned && !a.isFeatured);
  for (let i = regular.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = regular[i];
    regular[i] = regular[j]!;
    regular[j] = temp!;
  }
  const shuffledArticles = [...pinned, ...featured, ...regular];

  const nextCursor = articles.length === limit ? offset + limit : null;

  return { data: shuffledArticles, nextCursor };

};
