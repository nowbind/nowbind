package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"

	"github.com/nowbind/nowbind/internal/model"
	"github.com/nowbind/nowbind/internal/repository"
	"github.com/nowbind/nowbind/pkg"
)

type AuthService struct {
	users    *repository.UserRepository
	sessions *repository.SessionRepository
	secret   string
	email    *EmailService
}

var ErrMagicLinkDelivery = errors.New("magic link delivery failed")

func NewAuthService(users *repository.UserRepository, sessions *repository.SessionRepository, secret string, email *EmailService) *AuthService {
	return &AuthService{users: users, sessions: sessions, secret: secret, email: email}
}

func (s *AuthService) SendMagicLink(ctx context.Context, email, frontendURL string) (string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	token, err := s.sessions.CreateMagicLink(ctx, email)
	if err != nil {
		return "", err
	}

	magicLinkURL := fmt.Sprintf("%s/callback?token=%s", frontendURL, token)

	if err := s.email.SendMagicLinkEmail(email, magicLinkURL); err != nil {
		log.Printf("Failed to send magic link email to %s: %v", email, err)
		if cleanupErr := s.sessions.DeleteMagicLink(ctx, token); cleanupErr != nil {
			log.Printf("Failed to cleanup unsent magic link for %s: %v", email, cleanupErr)
		}
		return "", fmt.Errorf("%w: %v", ErrMagicLinkDelivery, err)
	}

	return token, nil
}

func (s *AuthService) VerifyMagicLink(ctx context.Context, token string) (*model.User, *model.Session, string, error) {
	email, err := s.sessions.VerifyMagicLink(ctx, token)
	if err != nil {
		return nil, nil, "", err
	}

	// Find or create user
	user, err := s.users.GetByEmail(ctx, email)
	if err != nil {
		return nil, nil, "", err
	}
	if user == nil {
		// Create new user
		username := strings.Split(email, "@")[0]
		username = pkg.Slugify(username)
		user = &model.User{
			Email:    email,
			Username: username,
		}
		if err := s.users.Create(ctx, user); err != nil {
			return nil, nil, "", fmt.Errorf("creating user: %w", err)
		}
	}

	// Create session
	session, err := s.sessions.Create(ctx, user.ID)
	if err != nil {
		return nil, nil, "", err
	}

	// Generate access token
	accessToken, err := pkg.GenerateAccessToken(user.ID, s.secret)
	if err != nil {
		return nil, nil, "", err
	}

	return user, session, accessToken, nil
}

// GoogleUserInfo fetches user info from Google using the access token
type GoogleUserInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func (s *AuthService) HandleGoogleCallback(ctx context.Context, code, clientID, clientSecret, redirectURI string) (*model.User, *model.Session, string, error) {
	// Exchange code for tokens
	values := url.Values{
		"code":          {code},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
	}
	tokenBody := values.Encode()

	resp, err := http.Post(
		"https://oauth2.googleapis.com/token",
		"application/x-www-form-urlencoded",
		strings.NewReader(tokenBody),
	)
	if err != nil {
		return nil, nil, "", fmt.Errorf("exchanging google code: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var tokenResp struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, nil, "", fmt.Errorf("parsing google token: %w", err)
	}
	if tokenResp.Error != "" {
		return nil, nil, "", fmt.Errorf("google oauth error: %s - %s", tokenResp.Error, tokenResp.ErrorDesc)
	}

	// Get user info
	userReq, _ := http.NewRequestWithContext(ctx, "GET", "https://www.googleapis.com/oauth2/v3/userinfo", nil)
	userReq.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)
	userResp, err := http.DefaultClient.Do(userReq)
	if err != nil {
		return nil, nil, "", fmt.Errorf("fetching google user info: %w", err)
	}
	defer userResp.Body.Close()

	var gUser GoogleUserInfo
	if err := json.NewDecoder(userResp.Body).Decode(&gUser); err != nil {
		return nil, nil, "", fmt.Errorf("parsing google user info: %w", err)
	}

	// Upsert user
	username := strings.Split(gUser.Email, "@")[0]
	username = pkg.Slugify(username)
	user := &model.User{
		Email:         gUser.Email,
		Username:      username,
		DisplayName:   gUser.Name,
		AvatarURL:     gUser.Picture,
		OAuthProvider: "google",
		OAuthID:       gUser.Sub,
	}
	if err := s.users.UpsertByOAuth(ctx, user); err != nil {
		return nil, nil, "", fmt.Errorf("upserting google user: %w", err)
	}

	// Check if user is banned
	banned, err := s.users.IsUserBanned(ctx, user.ID)
	if err != nil {
		return nil, nil, "", fmt.Errorf("checking ban status: %w", err)
	}
	if banned {
		return nil, nil, "", fmt.Errorf("account suspended")
	}

	// Create session
	session, err := s.sessions.Create(ctx, user.ID)
	if err != nil {
		return nil, nil, "", err
	}

	accessToken, err := pkg.GenerateAccessToken(user.ID, s.secret)
	if err != nil {
		return nil, nil, "", err
	}

	return user, session, accessToken, nil
}

// HandleGitHubCallback handles GitHub OAuth callback
func (s *AuthService) HandleGitHubCallback(ctx context.Context, code, clientID, clientSecret string) (*model.User, *model.Session, string, error) {
	// Exchange code for tokens
	ghValues := url.Values{
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"code":          {code},
	}
	tokenBody := ghValues.Encode()

	req, _ := http.NewRequestWithContext(ctx, "POST", "https://github.com/login/oauth/access_token", strings.NewReader(tokenBody))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, nil, "", fmt.Errorf("exchanging github code: %w", err)
	}
	defer resp.Body.Close()

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, nil, "", fmt.Errorf("parsing github token: %w", err)
	}
	if tokenResp.Error != "" {
		return nil, nil, "", fmt.Errorf("github oauth error: %s - %s", tokenResp.Error, tokenResp.ErrorDesc)
	}

	// Get user info
	userReq, _ := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user", nil)
	userReq.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)
	userResp, err := http.DefaultClient.Do(userReq)
	if err != nil {
		return nil, nil, "", fmt.Errorf("fetching github user info: %w", err)
	}
	defer userResp.Body.Close()

	var ghUser struct {
		ID        int    `json:"id"`
		Login     string `json:"login"`
		Name      string `json:"name"`
		Email     string `json:"email"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := json.NewDecoder(userResp.Body).Decode(&ghUser); err != nil {
		return nil, nil, "", fmt.Errorf("parsing github user info: %w", err)
	}

	// GitHub may not return email, fetch from emails endpoint
	if ghUser.Email == "" {
		emailReq, _ := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user/emails", nil)
		emailReq.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)
		emailResp, err := http.DefaultClient.Do(emailReq)
		if err == nil {
			defer emailResp.Body.Close()
			var emails []struct {
				Email   string `json:"email"`
				Primary bool   `json:"primary"`
			}
			if json.NewDecoder(emailResp.Body).Decode(&emails) == nil {
				for _, e := range emails {
					if e.Primary {
						ghUser.Email = e.Email
						break
					}
				}
			}
		}
	}

	if ghUser.Email == "" {
		return nil, nil, "", fmt.Errorf("could not get email from github")
	}

	username := pkg.Slugify(ghUser.Login)
	displayName := ghUser.Name
	if displayName == "" {
		displayName = ghUser.Login
	}

	user := &model.User{
		Email:         ghUser.Email,
		Username:      username,
		DisplayName:   displayName,
		AvatarURL:     ghUser.AvatarURL,
		OAuthProvider: "github",
		OAuthID:       fmt.Sprintf("%d", ghUser.ID),
	}
	if err := s.users.UpsertByOAuth(ctx, user); err != nil {
		return nil, nil, "", fmt.Errorf("upserting github user: %w", err)
	}

	// Check if user is banned
	banned, err := s.users.IsUserBanned(ctx, user.ID)
	if err != nil {
		return nil, nil, "", fmt.Errorf("checking ban status: %w", err)
	}
	if banned {
		return nil, nil, "", fmt.Errorf("account suspended")
	}

	session, err := s.sessions.Create(ctx, user.ID)
	if err != nil {
		return nil, nil, "", err
	}

	accessToken, err := pkg.GenerateAccessToken(user.ID, s.secret)
	if err != nil {
		return nil, nil, "", err
	}

	return user, session, accessToken, nil
}

// DevLogin creates or finds a user by email and issues tokens directly,
// bypassing OAuth and email verification. For local development only.
func (s *AuthService) DevLogin(ctx context.Context, email string) (*model.User, *model.Session, string, error) {
	email = strings.ToLower(strings.TrimSpace(email))

	user, err := s.users.GetByEmail(ctx, email)
	if err != nil {
		return nil, nil, "", err
	}
	if user == nil {
		username := strings.Split(email, "@")[0]
		username = pkg.Slugify(username)
		user = &model.User{
			Email:       email,
			Username:    username,
			DisplayName: "Dev User",
		}
		if err := s.users.Create(ctx, user); err != nil {
			return nil, nil, "", fmt.Errorf("creating dev user: %w", err)
		}
	}

	// Check if user is banned
	banned, err := s.users.IsUserBanned(ctx, user.ID)
	if err != nil {
		return nil, nil, "", fmt.Errorf("checking ban status: %w", err)
	}
	if banned {
		return nil, nil, "", fmt.Errorf("account suspended")
	}

	session, err := s.sessions.Create(ctx, user.ID)
	if err != nil {
		return nil, nil, "", err
	}

	accessToken, err := pkg.GenerateAccessToken(user.ID, s.secret)
	if err != nil {
		return nil, nil, "", err
	}

	return user, session, accessToken, nil
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*model.User, *model.Session, string, error) {
	session, err := s.sessions.GetByToken(ctx, refreshToken)
	if err != nil {
		return nil, nil, "", err
	}
	if session == nil {
		return nil, nil, "", fmt.Errorf("invalid refresh token")
	}

	// Delete old session
	s.sessions.Delete(ctx, refreshToken)

	// Create new session (token rotation)
	newSession, err := s.sessions.Create(ctx, session.UserID)
	if err != nil {
		return nil, nil, "", err
	}

	user, err := s.users.GetByID(ctx, session.UserID)
	if err != nil {
		return nil, nil, "", err
	}

	accessToken, err := pkg.GenerateAccessToken(session.UserID, s.secret)
	if err != nil {
		return nil, nil, "", err
	}

	return user, newSession, accessToken, nil
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	return s.sessions.Delete(ctx, refreshToken)
}

func (s *AuthService) GetUser(ctx context.Context, userID string) (*model.User, error) {
	return s.users.GetByID(ctx, userID)
}
