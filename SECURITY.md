# Security Policy

## Supported Versions

Only the latest release of NowBind receives security patches. We do not backport fixes to older versions.

| Version | Supported |
|---------|-----------|
| 0.1.x (latest) | Yes |
| < 0.1.0 | No |

Once v0.2.0 is released, v0.1.x will enter end-of-life status and will no longer receive security updates.

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub Issues.**

### Option 1 — GitHub Security Advisory (preferred)

Open a [GitHub Security Advisory](https://github.com/niheshr/nowbind/security/advisories/new) in this repository. GitHub keeps the advisory private until we coordinate a fix and disclosure.

### Option 2 — Email

Send details to **security@nowbind.niheshr.com**.

Encrypt sensitive reports with our PGP key (available on keys.openpgp.org, fingerprint published in the repository). Plain-text email is also acceptable if you prefer not to use PGP.

### What to include in your report

To help us triage quickly, please include:

- A clear description of the vulnerability
- Affected component(s) (backend endpoint, frontend page, infrastructure)
- Steps to reproduce (proof-of-concept code or curl commands are welcome)
- Potential impact / severity assessment
- Your suggested fix or mitigation, if you have one
- Whether you intend to publish a write-up, and a proposed disclosure timeline

---

## Response SLA

| Milestone | Target |
|-----------|--------|
| Acknowledgment | Within 48 hours of receipt |
| Initial triage and severity assessment | Within 5 business days |
| Fix for Critical / High severity | Within 14 days of triage |
| Fix for Medium severity | Within 30 days of triage |
| Fix for Low / Informational | Next scheduled release |
| Public disclosure | Coordinated with reporter; typically 90 days after fix |

We follow responsible coordinated disclosure. If circumstances require a longer timeline (e.g., complex architectural changes), we will communicate this proactively and keep you updated.

---

## What Counts as a Security Issue

The following are in scope for responsible disclosure:

- **Authentication and session management** — JWT forgery, session fixation, token leakage, insecure refresh flow
- **Authorization** — accessing or modifying another user's posts, settings, or private data without permission
- **SQL injection** — any query that allows arbitrary SQL execution via user input
- **Remote code execution (RCE)** — any path that allows arbitrary code to run on the server
- **Cross-site scripting (XSS)** — stored or reflected XSS in post content, comments, profile fields
- **Cross-site request forgery (CSRF)** — state-changing requests that bypass CSRF protection
- **Sensitive data exposure** — leaking password hashes, API keys, OAuth secrets, private posts, or user PII
- **Server-side request forgery (SSRF)** — triggering requests to internal services via user-supplied URLs
- **Insecure direct object reference (IDOR)** — accessing private resources via guessable IDs
- **Denial of service** — resource exhaustion attacks that take down the service without a distributed source
- **Dependency vulnerabilities** — critical CVEs in direct dependencies with a clear exploitation path against NowBind

---

## Out of Scope

The following are **not** eligible for responsible disclosure:

- Vulnerabilities in third-party services (Cloudflare, GitHub, Google, etc.) — report those directly to the respective vendor
- Issues only reproducible on versions we no longer support
- Social engineering attacks against NowBind maintainers or users
- Physical attacks against infrastructure
- Clickjacking on pages that do not perform sensitive actions
- Missing `Secure` or `SameSite` cookie flags on non-sensitive cookies
- Content injection without JavaScript execution (e.g., plain HTML injection into user bio that renders only text)
- Rate limiting on non-sensitive endpoints (e.g., public read endpoints)
- Brute-force attacks requiring millions of requests with no amplification factor
- Self-XSS (where the attacker must be the victim)
- Scanner-generated reports without a demonstrated impact
- Reports about outdated TLS cipher suites or missing HSTS on non-production instances

---

## Hall of Fame

We publicly thank security researchers who responsibly disclose valid vulnerabilities (with their permission) in the `SECURITY_HALL_OF_FAME.md` file once the issue is patched and disclosed.

---

## Bug Bounty

NowBind does not currently offer a paid bug bounty program. We are a self-funded open-source project. We do offer:

- Public credit in our Hall of Fame
- A NowBind contributor badge on your profile
- Our sincere gratitude

---

## Disclosure Policy

We follow the principle of coordinated vulnerability disclosure:

1. Reporter contacts us privately.
2. We acknowledge within 48 hours.
3. We develop and test a fix in a private branch.
4. We release the fix and a CVE (if warranted) simultaneously.
5. We publish a security advisory detailing the vulnerability, impact, and fix.
6. Reporter may publish their own write-up after the advisory is public.

We aim to credit the reporter in the advisory unless they prefer to remain anonymous.
