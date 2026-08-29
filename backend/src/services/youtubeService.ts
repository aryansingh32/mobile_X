import axios from 'axios';

interface YoutubeShort {
  videoId: string;
  title: string;
  channelTitle?: string;
  duration: number;
}

const parseIsoDuration = (duration: string): number => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
};

// This runs inline in GET /api/shorts whenever the admin-curated pool is
// depleted, so it's directly on the user's wait time — up to two sequential
// calls (search, then video details), each capped here rather than left at
// axios's default (effectively unbounded) or a large fixed timeout.
const YOUTUBE_REQUEST_TIMEOUT_MS = 5000;

export const searchYoutubeShorts = async (query: string, requestedCount: number): Promise<YoutubeShort[]> => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY is not configured');
  }

  const results = new Map<string, { videoId: string; title: string; channelTitle?: string }>();
  let pageToken: string | undefined;
  const searchTarget = Math.min(Math.max(requestedCount * 2, requestedCount), 200);

  while (results.size < searchTarget) {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        videoDuration: 'short',
        videoEmbeddable: 'true',
        safeSearch: 'moderate',
        maxResults: Math.min(50, searchTarget - results.size),
        pageToken,
        key: apiKey,
      },
      timeout: YOUTUBE_REQUEST_TIMEOUT_MS,
    });

    for (const item of response.data.items || []) {
      const videoId = item.id?.videoId;
      if (videoId) {
        results.set(videoId, {
          videoId,
          title: item.snippet?.title || 'YouTube Short',
          channelTitle: item.snippet?.channelTitle,
        });
      }
    }
    pageToken = response.data.nextPageToken;
    if (!pageToken || !(response.data.items || []).length) break;
  }

  const ids = [...results.keys()];
  const shorts: YoutubeShort[] = [];
  for (let index = 0; index < ids.length; index += 50) {
    const chunk = ids.slice(index, index + 50);
    const details = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { part: 'contentDetails,status', id: chunk.join(','), key: apiKey },
      timeout: YOUTUBE_REQUEST_TIMEOUT_MS,
    });
    for (const item of details.data.items || []) {
      const duration = parseIsoDuration(item.contentDetails?.duration || '');
      const base = results.get(item.id);
      if (base && duration > 0 && duration <= 180 && item.status?.embeddable !== false) {
        shorts.push({ ...base, duration });
      }
    }
  }
  return shorts;
};

// getShorts() calls this inline whenever the admin pool can't fill a page,
// which means every concurrent request during a depleted-pool window would
// otherwise each kick off their own search+details round trip to YouTube —
// a thundering herd on top of the per-user latency. A short in-process
// single-flight + cache means only one such round trip happens at a time,
// and repeated calls within FALLBACK_TTL_MS reuse the same result instead
// of hitting YouTube again.
const FALLBACK_TTL_MS = 60_000;
let cachedTrendingShorts: YoutubeShort[] = [];
let cachedAt = 0;
let inFlight: Promise<YoutubeShort[]> | null = null;

export const fetchTrendingShorts = async (): Promise<YoutubeShort[]> => {
  if (cachedTrendingShorts.length > 0 && Date.now() - cachedAt < FALLBACK_TTL_MS) {
    return cachedTrendingShorts;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const shorts = await searchYoutubeShorts('#shorts', 10);
      cachedTrendingShorts = shorts;
      cachedAt = Date.now();
      return shorts;
    } catch (error) {
      console.error('Error fetching shorts:', error);
      // Serve the last known-good batch rather than an empty page if we have one.
      return cachedTrendingShorts;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
};
