package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/nowbind/nowbind/internal/model"
	"github.com/nowbind/nowbind/internal/repository"
	"github.com/nowbind/nowbind/pkg"
)

type PasskeyService struct {
	webAuthn  *webauthn.WebAuthn
	passkeyRepo *repository.PasskeyRepository
	userRepo    *repository.UserRepository
	sessionRepo *repository.SessionRepository
	jwtSecret   string
}

func NewPasskeyService(
	rpID, rpName, rpOrigin string,
	passkeyRepo *repository.PasskeyRepository,
	userRepo *repository.UserRepository,
	sessionRepo *repository.SessionRepository,
	jwtSecret string,
) (*PasskeyService, error) {
	wconfig := &webauthn.Config{
		RPDisplayName: rpName,
		RPID:          rpID,
		RPOrigins:     []string{rpOrigin},
		Timeouts: webauthn.TimeoutsConfig{
			Login: webauthn.TimeoutConfig{
				Enforce:    true,
				Timeout:    time.Minute * 5,
			},
			Registration: webauthn.TimeoutConfig{
				Enforce:    true,
				Timeout:    time.Minute * 5,
			},
		},
	}

	wa, err := webauthn.New(wconfig)
	if err != nil {
		return nil, fmt.Errorf("creating webauthn: %w", err)
	}

	return &PasskeyService{
		webAuthn:    wa,
		passkeyRepo: passkeyRepo,
		userRepo:    userRepo,
		sessionRepo: sessionRepo,
		jwtSecret:   jwtSecret,
	}, nil
}

type webAuthnUser struct {
	id          []byte
	name        string
	displayName string
	credentials []webauthn.Credential
}

func (u *webAuthnUser) WebAuthnID() []byte                               { return u.id }
func (u *webAuthnUser) WebAuthnName() string                             { return u.name }
func (u *webAuthnUser) WebAuthnDisplayName() string                      { return u.displayName }
func (u *webAuthnUser) WebAuthnIcon() string                             { return "" }
func (u *webAuthnUser) WebAuthnCredentials() []webauthn.Credential       { return u.credentials }

func (s *PasskeyService) BeginRegistration(ctx context.Context, userID, name string) (*protocol.CredentialCreation, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return nil, fmt.Errorf("user not found")
	}

	existingCreds, err := s.passkeyRepo.GetCredentialsByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("getting existing credentials: %w", err)
	}

	var webauthnCreds []webauthn.Credential
	for _, cred := range existingCreds {
		webauthnCreds = append(webauthnCreds, webauthn.Credential{
			ID:        cred.CredentialID,
			PublicKey: cred.PublicKey,
		})
	}

	waUser := &webAuthnUser{
		id:          []byte(userID),
		name:        user.Email,
		displayName: user.DisplayName,
		credentials: webauthnCreds,
	}

	options, sessionData, err := s.webAuthn.BeginRegistration(waUser,
		webauthn.WithAuthenticatorSelection(protocol.AuthenticatorSelection{
			RequireResidentKey: protocol.ResidentKeyNotRequired(),
			UserVerification:   protocol.VerificationPreferred,
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("beginning registration: %w", err)
	}

	challenge := &model.PasskeyChallenge{
		UserID:    &userID,
		Challenge: []byte(sessionData.Challenge),
		Type:      "registration",
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
	if err := s.passkeyRepo.CreateChallenge(ctx, challenge); err != nil {
		return nil, fmt.Errorf("storing challenge: %w", err)
	}

	return options, nil
}

func (s *PasskeyService) FinishRegistration(ctx context.Context, userID, name string, credentialJSON []byte) error {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return fmt.Errorf("user not found")
	}

	var parsedResponse protocol.ParsedCredentialCreationData
	if err := json.Unmarshal(credentialJSON, &parsedResponse); err != nil {
		return fmt.Errorf("parsing credential: %w", err)
	}

	challenge, err := s.passkeyRepo.GetChallenge(ctx, []byte(parsedResponse.Response.CollectedClientData.Challenge))
	if err != nil || challenge == nil {
		return fmt.Errorf("invalid or expired challenge")
	}
	defer s.passkeyRepo.DeleteChallenge(ctx, challenge.ID)

	if challenge.UserID == nil || *challenge.UserID != userID {
		return fmt.Errorf("challenge user mismatch")
	}

	existingCreds, _ := s.passkeyRepo.GetCredentialsByUserID(ctx, userID)
	var webauthnCreds []webauthn.Credential
	for _, cred := range existingCreds {
		webauthnCreds = append(webauthnCreds, webauthn.Credential{
			ID:        cred.CredentialID,
			PublicKey: cred.PublicKey,
		})
	}

	waUser := &webAuthnUser{
		id:          []byte(userID),
		name:        user.Email,
		displayName: user.DisplayName,
		credentials: webauthnCreds,
	}

	sessionData := webauthn.SessionData{
		Challenge:            string(challenge.Challenge),
		UserID:               []byte(userID),
		UserVerification:     protocol.VerificationPreferred,
	}

	credential, err := s.webAuthn.CreateCredential(waUser, sessionData, &parsedResponse)
	if err != nil {
		return fmt.Errorf("creating credential: %w", err)
	}

	transports := make([]string, len(parsedResponse.Response.Transports))
	for i, t := range parsedResponse.Response.Transports {
		transports[i] = string(t)
	}

	passkeyCredential := &model.PasskeyCredential{
		UserID:       userID,
		CredentialID: credential.ID,
		PublicKey:    credential.PublicKey,
		AAGUID:       credential.Authenticator.AAGUID,
		SignCount:    int(credential.Authenticator.SignCount),
		Name:         name,
		Transports:   transports,
	}

	return s.passkeyRepo.CreateCredential(ctx, passkeyCredential)
}

func (s *PasskeyService) BeginLogin(ctx context.Context, email string) (*protocol.CredentialAssertion, error) {
	var userID *string
	if email != "" {
		user, err := s.userRepo.GetByEmail(ctx, email)
		if err != nil {
			return nil, fmt.Errorf("finding user: %w", err)
		}
		if user != nil {
			userID = &user.ID
		}
	}

	options, sessionData, err := s.webAuthn.BeginDiscoverableLogin()
	if err != nil {
		return nil, fmt.Errorf("beginning login: %w", err)
	}

	challenge := &model.PasskeyChallenge{
		UserID:    userID,
		Challenge: []byte(sessionData.Challenge),
		Type:      "authentication",
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
	if email != "" {
		challenge.Email = &email
	}

	if err := s.passkeyRepo.CreateChallenge(ctx, challenge); err != nil {
		return nil, fmt.Errorf("storing challenge: %w", err)
	}

	return options, nil
}

func (s *PasskeyService) FinishLogin(ctx context.Context, assertionJSON []byte) (*model.User, *model.Session, string, error) {
	var parsedResponse protocol.ParsedCredentialAssertionData
	if err := json.Unmarshal(assertionJSON, &parsedResponse); err != nil {
		return nil, nil, "", fmt.Errorf("parsing assertion: %w", err)
	}

	challenge, err := s.passkeyRepo.GetChallenge(ctx, []byte(parsedResponse.Response.CollectedClientData.Challenge))
	if err != nil || challenge == nil {
		return nil, nil, "", fmt.Errorf("invalid or expired challenge")
	}
	defer s.passkeyRepo.DeleteChallenge(ctx, challenge.ID)

	credentialID := []byte(parsedResponse.RawID)

	storedCred, err := s.passkeyRepo.GetCredentialByID(ctx, credentialID)
	if err != nil || storedCred == nil {
		return nil, nil, "", fmt.Errorf("credential not found")
	}

	user, err := s.userRepo.GetByID(ctx, storedCred.UserID)
	if err != nil || user == nil {
		return nil, nil, "", fmt.Errorf("user not found")
	}

	waUser := &webAuthnUser{
		id:          []byte(user.ID),
		name:        user.Email,
		displayName: user.DisplayName,
		credentials: []webauthn.Credential{
			{
				ID:        storedCred.CredentialID,
				PublicKey: storedCred.PublicKey,
				Authenticator: webauthn.Authenticator{
					AAGUID:    storedCred.AAGUID,
					SignCount: uint32(storedCred.SignCount),
				},
			},
		},
	}

	sessionData := webauthn.SessionData{
		Challenge:        string(challenge.Challenge),
		UserID:           []byte(user.ID),
		UserVerification: protocol.VerificationPreferred,
	}

	credential, err := s.webAuthn.ValidateLogin(waUser, sessionData, &parsedResponse)
	if err != nil {
		return nil, nil, "", fmt.Errorf("validating login: %w", err)
	}

	storedCred.SignCount = int(credential.Authenticator.SignCount)
	if err := s.passkeyRepo.UpdateCredential(ctx, storedCred); err != nil {
		return nil, nil, "", fmt.Errorf("updating credential: %w", err)
	}

	session, err := s.sessionRepo.Create(ctx, user.ID)
	if err != nil {
		return nil, nil, "", fmt.Errorf("creating session: %w", err)
	}

	accessToken, err := pkg.GenerateAccessToken(user.ID, s.jwtSecret)
	if err != nil {
		return nil, nil, "", fmt.Errorf("generating token: %w", err)
	}

	return user, session, accessToken, nil
}

func (s *PasskeyService) ListCredentials(ctx context.Context, userID string) ([]model.PasskeyCredential, error) {
	return s.passkeyRepo.GetCredentialsByUserID(ctx, userID)
}

func (s *PasskeyService) DeleteCredential(ctx context.Context, credentialID, userID string) error {
	return s.passkeyRepo.DeleteCredential(ctx, credentialID, userID)
}
