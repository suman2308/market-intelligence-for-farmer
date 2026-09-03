# ShetBhav Security

**Last updated:** September 2026

This document describes how ShetBhav handles secrets, authentication, and data — and what is NOT hardened yet. It is an MVP built for a hackathon, so please treat the gaps honestly.

---

## The one rule: never commit secrets

The data.gov.in API key, the JWT secret, and the database URL live in `backend/.env`, which is **gitignored**.

```bash
# Verify .env is ignored
git check-ignore -v backend/.env
# → backend/.env is ignored

# Verify no key leaked into tracked files
git grep -n "DATA_GOV_API_KEY" -- ':!*.md'  # should return nothing
```

Never:
- Commit a real `.env` file.
- Put the API key in frontend code, browser bundles, or docs.
- Paste a real key into chat or issues.
- Log the key. The data.gov client logs only status codes and counts, never the key.

If a real secret is ever committed, **rotate it immediately** (regenerate the data.gov.in key / JWT secret) — deleting the file from Git history is not enough because the secret is already compromised.

## Secrets inventory

| Secret | Where | Used for |
|--------|-------|----------|
| `DATA_GOV_API_KEY` | `backend/.env` | data.gov.in AGMARKNET API |
| `SECRET_KEY` | `backend/.env` | JWT signing |
| `DATABASE_URL` | `backend/.env` | DB connection (SQLite dev / PostgreSQL prod) |

`backend/.env.example` is the safe template — copy it to `.env`, never the other way.

## Authentication

- Passwords hashed with **bcrypt** — never stored in plain text.
- Login returns a **JWT** with a role claim.
- `GET /auth/me` restores sessions; the frontend stores the token in localStorage (acceptable for an MVP, not ideal for production — see gaps).
- Role-based access control (`require_role`) is enforced **server-side**, not just hidden in the UI.

## Authorization

- Farmer, buyer, FPO, and admin routes are gated by role.
- A farmer token cannot read buyer or admin data (verified by tests in `test_api.py`).

## Data protection

- Farmer/buyer/lot records are private to their owner — endpoints filter by the authenticated user.
- Payment amounts are simulated; no bank or card data is ever stored.
- Uploaded quality images are stored under `uploads/` and served by their own route.

## Input validation

- All API bodies validated with **Pydantic** schemas.
- Price/date/quantity fields validated on ingestion from data.gov.in; malformed rows are rejected and counted, never silently inserted.
- SQLAlchemy ORM with parameterized queries (no string-concatenated SQL).

## Logging & monitoring

- `GET /health` for uptime checks (UptimeRobot pings it every 5 min).
- `GET /sync/status` shows the last market-data sync result.
- Logs do not include tokens, passwords, or the API key.

---

## Known gaps (honest list)

| Gap | Severity | Notes |
|-----|----------|-------|
| Token in localStorage | Medium | XSS could read it; an httpOnly cookie is the production fix |
| No rate limiting | Medium | No per-IP throttle on login/register |
| No Alembic migrations | Medium | Schema built with `create_all()` — fine for dev, needs migrations for prod |
| No audit trail | Low | Admin actions aren't logged to a separate audit table |
| No CORS allowlist hardening | Low | CORS is permissive for local dev |
| Images served directly | Low | No malware scanning of uploads |
| No CSRF protection | Low | JWT-bearer API mitigates most CSRF risk |

## Production hardening checklist

1. Move the token to an httpOnly, Secure, SameSite cookie.
2. Add rate limiting (Redis-backed) on auth and sync endpoints.
3. Add Alembic migrations and run them in CI.
4. Restrict CORS to the real frontend origin.
5. Add structured logging + an audit trail for admin actions.
6. Scan uploads and store them in object storage with signed URLs.
7. Rotate secrets before any public launch.

## Reporting a vulnerability

Open a private issue on GitHub or contact the maintainers directly. Please don't post exploit details publicly before they're fixed.