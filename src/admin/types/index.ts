export interface OverviewStats {
  users: { total: number; today: number };
  posts: { total: number; today: number };
  peaks: number;
  guides: number;
  clubs: number;
  orders: number;
  revenue: number;
  tracks: number;
  images: number;
  generated_at: string;
}

export interface PendingStats {
  guide_applications: number;
  club_applications: number;
  reported_posts: number;
  banned_users: number;
}

export interface TrendPoint {
  date: string;
  count?: number;
  amount?: number;
  orders?: number;
  provider?: string;
}

export interface SosStats {
  monthly: Array<{ month: string; status: string; count: number }>;
  recent: Array<{
    id: number; user_id: number;
    lat: number; lng: number; altitude?: number;
    message?: string; status: string; created_at: string;
  }>;
}

export interface PeakTop {
  id: number; name: string; altitude: number;
  country: string; summit_count: number;
}

export interface WithdrawalStats {
  summary: Record<string, { count: number; amount: number }>;
  requests: Array<{
    id: number; owner_type: string; owner_id: number;
    amount: number; fee: number; actual_amount: number;
    account_type: string; status: string; created_at: string; note?: string;
  }>;
  pagination: { page: number; size: number; total: number; pages: number };
}

export interface AdminUser {
  id: number; username?: string; name?: string; isAdmin: boolean;
}
