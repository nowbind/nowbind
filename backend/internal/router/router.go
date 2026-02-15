package router

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nowbind/nowbind/internal/config"
	"github.com/nowbind/nowbind/internal/handler"
	"github.com/nowbind/nowbind/internal/mcp"
	"github.com/nowbind/nowbind/internal/middleware"
	"github.com/nowbind/nowbind/internal/repository"
	"github.com/nowbind/nowbind/internal/service"
)

func New(pool *pgxpool.Pool, cfg *config.Config) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.Logging)
	r.Use(chimw.Recoverer)
	r.Use(middleware.CORS(cfg.FrontendURL))

	// Repositories
	userRepo := repository.NewUserRepository(pool)
	sessionRepo := repository.NewSessionRepository(pool)
	postRepo := repository.NewPostRepository(pool)
	tagRepo := repository.NewTagRepository(pool)
	apiKeyRepo := repository.NewApiKeyRepository(pool)
	followRepo := repository.NewFollowRepository(pool)
	likeRepo := repository.NewLikeRepository(pool)
	commentRepo := repository.NewCommentRepository(pool)
	bookmarkRepo := repository.NewBookmarkRepository(pool)
	notifRepo := repository.NewNotificationRepository(pool)
	analyticsRepo := repository.NewAnalyticsRepository(pool)
	pushRepo := repository.NewPushRepository(pool)

	// Services
	emailService := service.NewEmailService(cfg)
	authService := service.NewAuthService(userRepo, sessionRepo, cfg.JWTSecret, emailService)
	postService := service.NewPostService(postRepo, tagRepo)
	socialService := service.NewSocialService(followRepo, likeRepo, bookmarkRepo, commentRepo, notifRepo, userRepo, postRepo)
	notifService := service.NewNotificationService(notifRepo, pushRepo, cfg.VAPIDPublicKey, cfg.VAPIDPrivateKey)

	// Handlers
	healthH := handler.NewHealthHandler()
	authH := handler.NewAuthHandler(authService, cfg)
	postH := handler.NewPostHandler(postService, postRepo)
	userH := handler.NewUserHandler(userRepo, postRepo)
	tagH := handler.NewTagHandler(tagRepo, postRepo)
	searchH := handler.NewSearchHandler(postRepo)
	feedH := handler.NewFeedHandler(postRepo, cfg.FrontendURL, cfg.FrontendURL)
	llmsH := handler.NewLLMSHandler(postRepo, cfg.FrontendURL)
	agentH := handler.NewAgentHandler(postRepo, tagRepo, userRepo, cfg.FrontendURL)
	apiKeyH := handler.NewApiKeyHandler(apiKeyRepo)
	socialH := handler.NewSocialHandler(socialService, followRepo, likeRepo, bookmarkRepo, commentRepo, postRepo, userRepo)
	notifH := handler.NewNotificationHandler(notifRepo, pushRepo, notifService)
	analyticsH := handler.NewAnalyticsHandler(analyticsRepo, postRepo)

	// Health
	r.Get("/health", healthH.Health)

	// Public: llms.txt
	r.Get("/llms.txt", llmsH.LLMSTxt)
	r.Get("/llms-full.txt", llmsH.LLMSFullTxt)

	// API v1
	r.Route("/api/v1", func(r chi.Router) {
		// Auth
		r.Route("/auth", func(r chi.Router) {
			r.Post("/magic-link", authH.SendMagicLink)
			r.Get("/magic-link/verify", authH.VerifyMagicLink)
			r.Post("/refresh", authH.Refresh)
			r.Post("/logout", authH.Logout)
			r.With(middleware.AuthMiddleware(cfg.JWTSecret)).Get("/me", authH.Me)

			// OAuth
			r.Get("/oauth/google", authH.GoogleLogin)
			r.Get("/oauth/google/callback", authH.GoogleCallback)
			r.Get("/oauth/github", authH.GitHubLogin)
			r.Get("/oauth/github/callback", authH.GitHubCallback)
		})

		// Posts (public)
		r.Route("/posts", func(r chi.Router) {
			r.With(middleware.OptionalAuth(cfg.JWTSecret)).Get("/", postH.List)
			r.With(middleware.OptionalAuth(cfg.JWTSecret)).Get("/trending", trendingHandler(postRepo))
			r.With(middleware.OptionalAuth(cfg.JWTSecret)).Get("/{slug}", postH.GetBySlug)
			r.With(middleware.OptionalAuth(cfg.JWTSecret)).Get("/{slug}/related", relatedHandler(postRepo))
			r.Post("/{slug}/view", analyticsH.TrackView)

			// Authenticated
			r.Group(func(r chi.Router) {
				r.Use(middleware.AuthMiddleware(cfg.JWTSecret))
				r.Post("/", postH.Create)
				r.Put("/{id}", postH.Update)
				r.Delete("/{id}", postH.Delete)
				r.Post("/{id}/publish", postH.Publish)
				r.Post("/{id}/unpublish", postH.Unpublish)
				r.Post("/{id}/like", socialH.LikePost)
				r.Delete("/{id}/like", socialH.UnlikePost)
				r.Post("/{id}/bookmark", socialH.BookmarkPost)
				r.Delete("/{id}/bookmark", socialH.UnbookmarkPost)
			})

			// Comments (public read, auth write)
			r.Get("/{id}/comments", socialH.GetComments)
			r.With(middleware.AuthMiddleware(cfg.JWTSecret)).Post("/{id}/comments", socialH.CreateComment)
		})

		// Users
		r.Route("/users", func(r chi.Router) {
			r.Get("/{username}", userH.GetByUsername)
			r.Get("/{username}/posts", userH.GetUserPosts)
			r.Get("/{username}/followers", socialH.GetFollowers)
			r.Get("/{username}/following", socialH.GetFollowing)

			r.Group(func(r chi.Router) {
				r.Use(middleware.AuthMiddleware(cfg.JWTSecret))
				r.Put("/me", userH.UpdateMe)
				r.Get("/me/posts", userH.MyPosts)
				r.Get("/me/liked", socialH.GetLikedPosts)
				r.Get("/me/bookmarks", socialH.GetBookmarks)
				r.Post("/{username}/follow", socialH.Follow)
				r.Delete("/{username}/follow", socialH.Unfollow)
			})
		})

		// Comments (edit/delete by ID)
		r.Route("/comments", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware(cfg.JWTSecret))
			r.Put("/{id}", socialH.UpdateComment)
			r.Delete("/{id}", socialH.DeleteComment)
		})

		// Feed (authenticated)
		r.With(middleware.AuthMiddleware(cfg.JWTSecret)).Get("/feed", socialH.Feed)

		// Tags
		r.Get("/tags", tagH.List)
		r.Get("/tags/{slug}/posts", tagH.GetPostsByTag)

		// Search
		r.Get("/search", searchH.Search)
		r.Get("/search/suggest", searchH.Suggest)

		// Feeds
		r.Get("/feeds/rss", feedH.RSS)
		r.Get("/feeds/atom", feedH.Atom)
		r.Get("/feeds/json", feedH.JSON)

		// Notifications
		r.Route("/notifications", func(r chi.Router) {
			r.Get("/vapid-key", notifH.VAPIDKey)

			r.Group(func(r chi.Router) {
				r.Use(middleware.AuthMiddleware(cfg.JWTSecret))
				r.Get("/", notifH.List)
				r.Get("/unread-count", notifH.UnreadCount)
				r.Post("/{id}/read", notifH.MarkRead)
				r.Post("/read-all", notifH.MarkAllRead)
				r.Post("/subscribe", notifH.Subscribe)
				r.Post("/unsubscribe", notifH.Unsubscribe)
				r.Get("/preferences", notifH.GetPreferences)
				r.Put("/preferences", notifH.UpdatePreferences)
			})
		})

		// Stats (authenticated)
		r.Route("/stats", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware(cfg.JWTSecret))
			r.Get("/overview", analyticsH.Overview)
			r.Get("/timeline", analyticsH.Timeline)
			r.Get("/top-posts", analyticsH.TopPosts)
			r.Get("/referrers", analyticsH.Referrers)
		})

		// Agent API (API key auth)
		r.Route("/agent", func(r chi.Router) {
			r.Use(middleware.ApiKeyAuth(pool))
			r.Get("/posts", agentH.ListPosts)
			r.Get("/posts/{slug}", agentH.GetPost)
			r.Get("/search", agentH.Search)
			r.Get("/authors", agentH.ListAuthors)
			r.Get("/tags", agentH.ListTags)
		})

		// API Keys
		r.Route("/api-keys", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware(cfg.JWTSecret))
			r.Post("/", apiKeyH.Create)
			r.Get("/", apiKeyH.List)
			r.Delete("/{id}", apiKeyH.Delete)
		})
	})

	// MCP Server (API key auth, Streamable HTTP)
	mcpServer := mcp.NewMCPServer(postRepo, tagRepo, userRepo, cfg.FrontendURL)
	r.Route("/mcp", func(r chi.Router) {
		r.Use(middleware.ApiKeyAuth(pool))
		r.Handle("/", mcpServer)
	})

	return r
}

func trendingHandler(postRepo *repository.PostRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		days, _ := strconv.Atoi(r.URL.Query().Get("days"))
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		if days < 1 {
			days = 7
		}
		if limit < 1 {
			limit = 5
		}
		posts, err := postRepo.GetTrending(r.Context(), days, limit)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error":"failed to get trending posts"}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		handler.WriteJSONPublic(w, posts)
	}
}

func relatedHandler(postRepo *repository.PostRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := chi.URLParam(r, "slug")
		post, err := postRepo.GetBySlug(r.Context(), slug)
		if err != nil || post == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(`{"error":"post not found"}`))
			return
		}
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		if limit < 1 {
			limit = 3
		}
		related, err := postRepo.GetRelated(r.Context(), post.ID, limit)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error":"failed to get related posts"}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		handler.WriteJSONPublic(w, related)
	}
}
