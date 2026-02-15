export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  follower_count: number;
  following_count: number;
  is_following?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  author: User;
  slug: string;
  title: string;
  subtitle: string;
  content: string;
  excerpt: string;
  status: "draft" | "published";
  reading_time: number;
  like_count: number;
  comment_count: number;
  is_liked?: boolean;
  is_bookmarked?: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  tags: Tag[];
  ai_summary: string;
  ai_keywords: string[];
  structured_md: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  post_count: number;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  author?: User;
  parent_id?: string;
  content: string;
  replies?: Comment[];
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "new_follower" | "new_like" | "new_comment";
  actor_id?: string;
  actor?: User;
  post_id?: string;
  post?: Post;
  comment_id?: string;
  read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  new_follower: boolean;
  new_comment: boolean;
  new_like: boolean;
}

export interface StatsOverview {
  total_views: number;
  unique_views: number;
  ai_views: number;
  total_posts: number;
  total_likes: number;
  total_follows: number;
}

export interface ViewsByDate {
  date: string;
  view_count: number;
  unique_views: number;
  ai_views: number;
}

export interface PostStatsDetail {
  post_id: string;
  title: string;
  slug: string;
  view_count: number;
  unique_views: number;
  like_count: number;
}

export interface ReferrerStat {
  referrer: string;
  count: number;
}

export interface PostStats {
  post_id: string;
  total_views: number;
  unique_views: number;
}

export interface ApiKey {
  id: string;
  key_prefix: string;
  scopes: string[];
  rate_limit: number;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface SearchResult {
  posts: Post[];
  total: number;
  query: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
}
