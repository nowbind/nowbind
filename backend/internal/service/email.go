package service

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/smtp"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/nowbind/nowbind/internal/config"
)

type EmailService struct {
	sender       string
	clientID     string
	clientSecret string
	refreshToken string
	enabled      bool
	logoData     []byte // PNG logo bytes for CID embedding
}

func NewEmailService(cfg *config.Config) *EmailService {
	enabled := cfg.EmailSender != "" && cfg.GmailRefreshToken != ""
	if !enabled {
		log.Println("Email service disabled: missing EMAIL_SENDER or GMAIL_REFRESH_TOKEN")
	}

	svc := &EmailService{
		sender:       cfg.EmailSender,
		clientID:     cfg.GmailClientID,
		clientSecret: cfg.GmailClientSecret,
		refreshToken: cfg.GmailRefreshToken,
		enabled:      enabled,
	}

	// Load the logo from assets
	svc.loadLogo()

	return svc
}

func (s *EmailService) loadLogo() {
	// Try relative to the binary, then relative to this source file
	paths := []string{
		"assets/logo-dark.png",
		"../assets/logo-dark.png",
	}

	// Also try relative to the source file location
	_, filename, _, ok := runtime.Caller(0)
	if ok {
		dir := filepath.Dir(filename)
		paths = append(paths,
			filepath.Join(dir, "../../assets/logo-dark.png"),
			filepath.Join(dir, "../../../assets/logo-dark.png"),
		)
	}

	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err == nil {
			s.logoData = data
			log.Printf("Loaded email logo from %s (%d bytes)", p, len(data))
			return
		}
	}

	log.Println("Warning: could not load email logo, emails will use text fallback")
}

func (s *EmailService) IsEnabled() bool {
	return s.enabled
}

func (s *EmailService) getAccessToken() (string, error) {
	body := fmt.Sprintf(
		"client_id=%s&client_secret=%s&refresh_token=%s&grant_type=refresh_token",
		s.clientID, s.clientSecret, s.refreshToken,
	)

	resp, err := http.Post(
		"https://oauth2.googleapis.com/token",
		"application/x-www-form-urlencoded",
		strings.NewReader(body),
	)
	if err != nil {
		return "", fmt.Errorf("requesting access token: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("reading token response: %w", err)
	}

	var result struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("parsing token response: %w", err)
	}
	if result.Error != "" {
		return "", fmt.Errorf("oauth error: %s - %s", result.Error, result.ErrorDesc)
	}
	return result.AccessToken, nil
}

func (s *EmailService) SendMagicLinkEmail(toEmail, magicLinkURL string) error {
	if !s.enabled {
		log.Printf("[email-disabled] Magic link for %s: %s", toEmail, magicLinkURL)
		return nil
	}

	accessToken, err := s.getAccessToken()
	if err != nil {
		return fmt.Errorf("getting gmail access token: %w", err)
	}

	subject := "Sign in to NowBind"
	htmlBody := s.buildMagicLinkHTML(magicLinkURL)
	msg := s.buildMIMEMessage(s.sender, toEmail, subject, htmlBody)

	auth := newXOAuth2Auth(s.sender, accessToken)
	err = smtp.SendMail("smtp.gmail.com:587", auth, s.sender, []string{toEmail}, msg)
	if err != nil {
		return fmt.Errorf("sending email via gmail: %w", err)
	}

	log.Printf("Magic link email sent to %s", toEmail)
	return nil
}

func (s *EmailService) buildMagicLinkHTML(magicLinkURL string) string {
	logoHTML := s.logoImgTag()
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; max-width: 480px;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 40px 40px 24px;">
              %s
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td align="center" style="padding: 0 40px;">
              <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin: 0 0 12px;">Sign in to NowBind</h2>
              <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 28px;">Click the button below to sign in to your account. This link expires in 15 minutes.</p>
            </td>
          </tr>
          <!-- Button -->
          <tr>
            <td align="center" style="padding: 0 40px 32px;">
              <a href="%s" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px;">Sign in to NowBind</a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 40px 40px; border-top: 1px solid #eee;">
              <p style="font-size: 12px; color: #999; line-height: 1.5; margin: 0;">If you didn't request this email, you can safely ignore it.<br>This link will expire in 15 minutes.</p>
            </td>
          </tr>
        </table>
        <!-- Brand footer -->
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width: 480px;">
          <tr>
            <td align="center" style="padding: 24px 0;">
              <p style="font-size: 11px; color: #bbb; margin: 0;">NowBind &mdash; Write for humans. Feed the machines.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, logoHTML, magicLinkURL)
}

func (s *EmailService) logoImgTag() string {
	if len(s.logoData) > 0 {
		return `<img src="cid:logo" alt="NowBind" width="48" height="48" style="width: 48px; height: 48px; border-radius: 10px;">`
	}
	// Fallback if logo file couldn't be loaded
	return `<div style="width: 48px; height: 48px; background: #1a1a1a; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: 20px; font-weight: 700; font-family: serif;">N.</div>`
}

// buildMIMEMessage creates a multipart/related email with HTML body and inline logo
func (s *EmailService) buildMIMEMessage(from, to, subject, htmlBody string) []byte {
	boundary := "----=_NowBind_Boundary_001"

	var sb strings.Builder

	// Headers
	sb.WriteString(fmt.Sprintf("From: NowBind <%s>\r\n", from))
	sb.WriteString(fmt.Sprintf("To: %s\r\n", to))
	sb.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	sb.WriteString("MIME-Version: 1.0\r\n")

	if len(s.logoData) > 0 {
		// Multipart/related for HTML + inline image
		sb.WriteString(fmt.Sprintf("Content-Type: multipart/related; boundary=\"%s\"\r\n", boundary))
		sb.WriteString("\r\n")

		// HTML part
		sb.WriteString(fmt.Sprintf("--%s\r\n", boundary))
		sb.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
		sb.WriteString("Content-Transfer-Encoding: 7bit\r\n")
		sb.WriteString("\r\n")
		sb.WriteString(htmlBody)
		sb.WriteString("\r\n")

		// Logo image part (CID)
		sb.WriteString(fmt.Sprintf("--%s\r\n", boundary))
		sb.WriteString("Content-Type: image/png; name=\"logo.png\"\r\n")
		sb.WriteString("Content-Transfer-Encoding: base64\r\n")
		sb.WriteString("Content-Disposition: inline; filename=\"logo.png\"\r\n")
		sb.WriteString("Content-ID: <logo>\r\n")
		sb.WriteString("\r\n")

		// Base64 encode the logo, wrapping at 76 chars
		encoded := base64.StdEncoding.EncodeToString(s.logoData)
		for i := 0; i < len(encoded); i += 76 {
			end := i + 76
			if end > len(encoded) {
				end = len(encoded)
			}
			sb.WriteString(encoded[i:end])
			sb.WriteString("\r\n")
		}

		sb.WriteString(fmt.Sprintf("--%s--\r\n", boundary))
	} else {
		// Simple HTML email (no attachments)
		sb.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
		sb.WriteString("\r\n")
		sb.WriteString(htmlBody)
	}

	return []byte(sb.String())
}

// xoauth2Auth implements smtp.Auth for XOAUTH2
type xoauth2Auth struct {
	user        string
	accessToken string
}

func newXOAuth2Auth(user, accessToken string) smtp.Auth {
	return &xoauth2Auth{user: user, accessToken: accessToken}
}

func (a *xoauth2Auth) Start(server *smtp.ServerInfo) (string, []byte, error) {
	response := fmt.Sprintf("user=%s\x01auth=Bearer %s\x01\x01", a.user, a.accessToken)
	return "XOAUTH2", []byte(response), nil
}

func (a *xoauth2Auth) Next(fromServer []byte, more bool) ([]byte, error) {
	if more {
		return nil, fmt.Errorf("xoauth2 unexpected challenge: %s", fromServer)
	}
	return nil, nil
}
