// Uses Next.js rewrites to proxy /api/* to the Go backend
export const API_URL =
  process.env.NEXT_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "/api/v1";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const SITE_NAME = "NowBind";
export const POSTS_PER_PAGE = 10;
export const MAX_TITLE_LENGTH = 150;
export const MAX_EXCERPT_LENGTH = 300;
export const MAX_BIO_LENGTH = 500;