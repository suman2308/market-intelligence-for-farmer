# Contributing to ShetBhav

Thanks for wanting to help. This is a hackathon MVP, so contributions that fix real bugs, improve the demo flow, or make the docs honest are especially welcome.

---

## Ground rules

- **Be honest.** Don't label demo data as live, don't claim features that don't work.
- **Keep scope tight.** The MVP is Maharashtra + Onion/Tomato/Soybean + 4 roles. Big new features belong in an issue first.
- **Never commit secrets.** `.env` is gitignored for a reason (see [SECURITY.md](./SECURITY.md)).
- **Preserve tests.** If you change behavior, update or add tests. 175 tests must keep passing.

---

## Setup

```bash
# Backend
cd shetbhav/backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# Frontend
cd shetbhav/frontend
npm install
npm run dev
```

## Running checks

```bash
# Backend tests
cd shetbhav/backend
python -m pytest tests/ -v

# E2E demo flow
python e2e_demo.py

# Frontend build
cd shetbhav/frontend
npm run build
```

All three should pass before you open a PR.

---

## Code style

### Backend (Python)

- Follow PEP 8; keep functions small and named for what they do.
- Pydantic schemas validate every request body.
- New endpoints go in `app/main.py` (or a router if it grows), services in `app/services/`.
- Tests live in `backend/tests/test_*.py` and must not depend on each other's order.

### Frontend (TypeScript/React)

- Use the design system: color tokens (`var(--green-600)`, etc.), typography classes, and shared components from `src/components/ui.tsx`. See [DESIGN.md](./DESIGN.md).
- Farmer-facing pages: mobile-first, one question per screen, 48px+ touch targets.
- New strings must be added to all three locales in `src/lib/i18n.ts` (en, hi, mr).

## Commit messages

Short, factual, imperative:

```
Add retry with backoff to data.gov sync

Sync now retries up to 3 times on timeout/5xx before falling back
to cached data. Adds tests for the retry path.
```

## Pull requests

1. Branch from `main` (`git checkout -b fix/describe-the-fix`).
2. Make your change, add tests, run the checks above.
3. Open a PR describing **what** and **why**. Screenshots help for UI changes.

## Reporting issues

- **Bugs:** what you did, what you expected, what happened, browser/OS, and console errors if any.
- **Feature requests:** the farmer problem it solves, not just the feature name.
- **Docs:** link the file and section that confused you.

## Documentation contributions

If you touch behavior, update the matching doc — API.md for endpoints, DATA_SOURCES.md for data, LIMITATIONS.md for honest scope notes, PROJECT_STATUS.md for status changes. Stale docs are worse than no docs.