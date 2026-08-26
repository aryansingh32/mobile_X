export interface DiscoverBullet {
  text: string;
  sourcePill?: string;
  isBoldPart?: string; // Optional: basic simulation of bold words
}

export interface DiscoverCardData {
  id: string;
  imageUri: string;
  title: string;
  description: string;
  authorAvatar: string;
  authorUsername: string;
  bgColor: string;
  sourcesCount: string;
  timeAgo: string;
  bullets: DiscoverBullet[];
  sourceUrl?: string;
  isAd?: boolean;
}

export const discoverCategories = [
  "For You",
  "Top Stories",
  "Tech & Science",
  "Business",
  "Entertainment"
];

export const discoverData: DiscoverCardData[] = [
  {
    id: "0",
    imageUri: "https://images.unsplash.com/photo-1590059556011-37d4fdf80735?w=800&q=80",
    title: "Indian Navy recovers unexploded warhead from tanker off Kochi",
    description: "The Indian Navy announced on Wednesday that it had successfully completed a high-risk operation to recov...",
    authorAvatar: "https://i.pravatar.cc/100?img=9",
    authorUsername: "mialua",
    bgColor: "#546A5E",
    sourcesCount: "10 sources",
    timeAgo: "1h",
    bullets: [
      {
        text: "The operation was carried out by the Indian Navy EOD team.",
        sourcePill: "defense +2"
      },
      {
        text: "No casualties were reported and the shipping lane has been cleared."
      }
    ]
  },
  {
    id: "1",
    imageUri: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=800&q=80",
    title: "Apple says new Siri AI won't flatter or romance users",
    description: "Apple on Monday introduced Siri AI, a rebuilt version of its voice assistant powered by Google's Gemini foundation ...",
    authorAvatar: "https://i.pravatar.cc/100?img=12",
    authorUsername: "aetheris",
    bgColor: "#9BA1B9",
    sourcesCount: "28 sources",
    timeAgo: "52m",
    bullets: [
      {
        text: "Apple SVP Craig Federighi said the Gemini-powered Siri AI will refuse romantic interactions and resist sycophantic engagement with users.",
        sourcePill: "macrumors +1"
      },
      {
        text: "The rebuilt assistant, unveiled at WWDC on Monday, uses Google Gemini as its foundation model but carries no Google"
      }
    ]
  },
  {
    id: "2",
    imageUri: "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800&q=80",
    title: "World Bank raises India growth forecast, cuts global outlook",
    description: "The World Bank on Thursday upgraded India's economic growth forecast even as it cut projections for much of the global e...",
    authorAvatar: "https://i.pravatar.cc/100?img=33",
    authorUsername: "aaronmut",
    bgColor: "#8A6D68",
    sourcesCount: "12 sources",
    timeAgo: "2h",
    bullets: [
      {
        text: "The World Bank increased India's growth projection for the current fiscal year, reflecting strong momentum in domestic demand.",
        sourcePill: "reuters +2"
      },
      {
        text: "However, the global economic outlook remains subdued amid tighter financial conditions and geopolitical tensions."
      }
    ]
  },
  {
    id: "3",
    imageUri: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80",
    title: "Google confirms ShinyHunters exploited Oracle PeopleSoft zero-day to steal data",
    description: "The ShinyHunters hacking group exploited a critical zero-day vulnerability in Oracle PeopleSoft to breach more than...",
    authorAvatar: "https://i.pravatar.cc/100?img=47",
    authorUsername: "feylune",
    bgColor: "#6B1920",
    sourcesCount: "14 sources",
    timeAgo: "4h",
    bullets: [
      {
        text: "Google's Mandiant confirmed ShinyHunters exploited CVE-2026-35273, a critical PeopleSoft flaw rated 9.8, as a zero-day between 27 May and 9 June.",
        sourcePill: "securityweek +1"
      },
      {
        text: "The University of Nottingham confirmed a breach exposing roughly 454,600 email"
      }
    ]
  }
];
