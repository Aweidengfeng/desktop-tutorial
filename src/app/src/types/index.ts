// ─── Domain Types ────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  nickname?: string;
  avatar?: string;
  bio?: string;
  phone?: string;
  email?: string;
  level?: string;
  summitCount?: number;
  followersCount?: number;
  followingCount?: number;
  createdAt?: string;
}

export interface Peak {
  id: number;
  name: string;
  altitude: number;
  location?: string;
  country?: string;
  difficulty?: string;
  bestSeason?: string;
  description?: string;
  imageUrl?: string;
  firstAscent?: string;
  firstAscentBy?: string;
}

export interface Post {
  id: number;
  title?: string;
  content: string;
  imageUrls?: string[];
  author?: User;
  authorId?: number;
  likesCount?: number;
  commentsCount?: number;
  liked?: boolean;
  saved?: boolean;
  createdAt: string;
  peak?: Peak;
}

export interface Guide {
  id: number;
  userId: number;
  user?: User;
  name?: string;
  certNumber?: string;
  specialties?: string[];
  rating?: number;
  reviewsCount?: number;
  bio?: string;
  pricePerDay?: number;
  currency?: string;
  expeditionCount?: number;
}

export interface Club {
  id: number;
  name: string;
  description?: string;
  coverUrl?: string;
  memberCount?: number;
  isJoined?: boolean;
  region?: string;
}

export interface Team {
  id: number;
  name: string;
  description?: string;
  coverUrl?: string;
  memberCount?: number;
  isJoined?: boolean;
  targetPeak?: Peak;
  plannedDate?: string;
}

export interface Expedition {
  id: number;
  name: string;
  peak?: Peak;
  status?: string;
  startDate?: string;
  endDate?: string;
  maxMembers?: number;
  currentMembers?: number;
  price?: number;
  currency?: string;
  guide?: Guide;
}

export interface AppConfig {
  env: string;
  apiBase: string;
  mapProvider: 'mapbox' | 'amap';
  mapboxToken: string;
  amapKey: string;
  amapSecurityCode: string;
  stripePublishableKey: string;
  googleClientId: string;
  appleClientId: string;
  sentryDsn: string;
  region: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}
