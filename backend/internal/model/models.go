package model

import "time"

type User struct {
	ID              string    `json:"id"`
	Email           string    `json:"-"`
	Username        string    `json:"username"`
	DisplayName     string    `json:"display_name"`
	Bio             string    `json:"bio"`
	AvatarURL       string    `json:"avatar_url"`
	OAuthProvider   string    `json:"-"`
	OAuthID         string    `json:"-"`
	Website         string    `json:"website,omitempty"`
	TwitterURL      string    `json:"twitter_url,omitempty"`
	GitHubURL       string    `json:"github_url,omitempty"`
	MetaTitle       string    `json:"meta_title,omitempty"`
	MetaDescription string    `json:"meta_description,omitempty"`
	FollowerCount   int       `json:"follower_count"`
	FollowingCount  int       `json:"following_count"`
	IsFollowing     bool      `json:"is_following,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type Post struct {
	ID            string     `json:"id"`
	AuthorID      string     `json:"author_id"`
	Author        *User      `json:"author,omitempty"`
	Slug          string     `json:"slug"`
	Title         string     `json:"title"`
	Subtitle      string     `json:"subtitle"`
	Content       string     `json:"content"`
	ContentJSON   *string    `json:"content_json,omitempty"`
	ContentFormat string     `json:"content_format"`
	Excerpt       string     `json:"excerpt"`
	FeatureImage  string     `json:"feature_image,omitempty"`
	Featured      bool       `json:"featured"`
	Status        string     `json:"status"` // "draft" | "published"
	ReadingTime   int        `json:"reading_time"`
	LikeCount     int        `json:"like_count"`
	CommentCount  int        `json:"comment_count"`
	IsLiked       bool       `json:"is_liked,omitempty"`
	IsBookmarked  bool       `json:"is_bookmarked,omitempty"`
	PublishedAt   *time.Time `json:"published_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	Tags          []Tag      `json:"tags"`
	AISummary     string     `json:"ai_summary"`
	AIKeywords    []string   `json:"ai_keywords"`
	StructuredMD  string     `json:"structured_md"`
}

type Media struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	Filename     string    `json:"filename"`
	OriginalName string    `json:"original_name"`
	MimeType     string    `json:"mime_type"`
	SizeBytes    int64     `json:"size_bytes"`
	URL          string    `json:"url"`
	R2Key        string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

type Tag struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	PostCount int    `json:"post_count"`
}

type PostTag struct {
	PostID string
	TagID  string
}

type Session struct {
	RefreshToken string
	UserID       string
	ExpiresAt    time.Time
	CreatedAt    time.Time
}

type MagicLink struct {
	Email     string
	Token     string
	ExpiresAt time.Time
	UsedAt    *time.Time
}

type ApiKey struct {
	ID         string     `json:"id"`
	UserID     string     `json:"user_id"`
	KeyHash    string     `json:"-"`
	KeyPrefix  string     `json:"key_prefix"`
	Scopes     []string   `json:"scopes"`
	RateLimit  int        `json:"rate_limit"`
	ExpiresAt  *time.Time `json:"expires_at"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt *time.Time `json:"last_used_at"`
}

type PostView struct {
	ID        string
	PostID    string
	ViewerIP  string
	Referrer  string
	Source    string
	UserAgent string
	ViewedAt  time.Time
}

type PostStats struct {
	PostID      string `json:"post_id"`
	ViewDate    string `json:"view_date"`
	ViewCount   int    `json:"view_count"`
	UniqueViews int    `json:"unique_views"`
	AIViewCount int    `json:"ai_view_count"`
}

type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	PerPage    int         `json:"per_page"`
	TotalPages int         `json:"total_pages"`
}

// Social models

type Follow struct {
	FollowerID  string    `json:"follower_id"`
	FollowingID string    `json:"following_id"`
	CreatedAt   time.Time `json:"created_at"`
}

type PostLike struct {
	UserID    string    `json:"user_id"`
	PostID    string    `json:"post_id"`
	CreatedAt time.Time `json:"created_at"`
}

type Comment struct {
	ID        string    `json:"id"`
	PostID    string    `json:"post_id"`
	AuthorID  string    `json:"author_id"`
	Author    *User     `json:"author,omitempty"`
	ParentID  *string   `json:"parent_id,omitempty"`
	Content   string    `json:"content"`
	Replies   []Comment `json:"replies,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Bookmark struct {
	UserID    string    `json:"user_id"`
	PostID    string    `json:"post_id"`
	CreatedAt time.Time `json:"created_at"`
}

type Notification struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Type      string    `json:"type"` // new_follower, new_like, new_comment
	ActorID   *string   `json:"actor_id,omitempty"`
	Actor     *User     `json:"actor,omitempty"`
	PostID    *string   `json:"post_id,omitempty"`
	Post      *Post     `json:"post,omitempty"`
	CommentID *string   `json:"comment_id,omitempty"`
	Read      bool      `json:"read"`
	CreatedAt time.Time `json:"created_at"`
}

type PushSubscription struct {
	ID       string `json:"id"`
	UserID   string `json:"user_id"`
	Endpoint string `json:"endpoint"`
	P256dh   string `json:"p256dh"`
	Auth     string `json:"auth"`
}

type NotificationPreferences struct {
	UserID      string `json:"user_id"`
	NewFollower bool   `json:"new_follower"`
	NewComment  bool   `json:"new_comment"`
	NewLike     bool   `json:"new_like"`
}

// Tracking types

type LoginLog struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	IPAddress   string    `json:"ip_address"`
	UserAgent   string    `json:"user_agent"`
	LoginMethod string    `json:"login_method"`
	CreatedAt   time.Time `json:"created_at"`
}

type ApiKeyUsage struct {
	ID         string    `json:"id"`
	ApiKeyID   string    `json:"api_key_id"`
	Endpoint   string    `json:"endpoint"`
	Method     string    `json:"method"`
	StatusCode int       `json:"status_code"`
	IPAddress  string    `json:"ip_address"`
	UserAgent  string    `json:"user_agent"`
	CreatedAt  time.Time `json:"created_at"`
}

// Analytics types

type StatsOverview struct {
	TotalViews   int `json:"total_views"`
	UniqueViews  int `json:"unique_views"`
	AIViews      int `json:"ai_views"`
	TotalPosts   int `json:"total_posts"`
	TotalLikes   int `json:"total_likes"`
	TotalFollows int `json:"total_follows"`
}

type ViewsByDate struct {
	Date        string `json:"date"`
	ViewCount   int    `json:"view_count"`
	UniqueViews int    `json:"unique_views"`
	AIViews     int    `json:"ai_views"`
}

type PostStatsDetail struct {
	PostID      string `json:"post_id"`
	Title       string `json:"title"`
	Slug        string `json:"slug"`
	ViewCount   int    `json:"view_count"`
	UniqueViews int    `json:"unique_views"`
	LikeCount   int    `json:"like_count"`
}

type ReferrerStat struct {
	Referrer string `json:"referrer"`
	Count    int    `json:"count"`
}
