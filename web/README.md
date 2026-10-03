# LearnMind AI — Web

The public website (company and product information) and the full browser app. Next.js 16 (App Router),
React 19, TypeScript, Tailwind CSS 4. It has no server-side logic of its own: after the page loads, the browser
talks directly to the backend's API gateway.

## Layout

```
web/src/
├── app/
│   ├── page.tsx                     public landing page (rendered from content/site.ts)
│   ├── login/  register/            sign-in and sign-up
│   └── app/                         the signed-in app (layout.tsx guards it and draws the navigation)
│       ├── page.tsx                 home: recommendations and progress
│       ├── learn/                   learning paths → [id] path → module/[moduleId] lesson + quiz
│       ├── documents/               library → [id] summary, mind map, deep analysis, exam prep
│       ├── knowledge/               knowledge graph
│       ├── analytics/               personal and institution dashboards
│       ├── admin/users, admin/audit administrators only
│       └── settings/                profile, theme, institution, password
├── components/
│   ├── Providers.tsx                session (AuthContext) and theme (ThemeContext)
│   ├── ui.tsx                       buttons, fields, cards, tabs, useLoad data hook
│   ├── AnalysisView.tsx  Quiz.tsx  AuthForm.tsx  ThemeToggle.tsx
├── content/site.ts                  ALL landing-page copy and company details (placeholders — edit here)
└── lib/
    ├── api.ts                       fetch wrapper: bearer token, silent refresh, errors
    └── types.ts                     API response types
```

## How it works

- **Session.** The access token is held in memory only. The refresh token is an `HttpOnly` cookie set by the
  backend, so page scripts can never read it. On load, and whenever a request returns 401, `lib/api.ts` calls
  `/api/auth/refresh` once and retries; if that fails the user is sent to sign in.
- **Authorization.** `app/app/layout.tsx` redirects signed-out visitors and shows navigation by role. Pages for
  admins also check the role. These checks are for clarity only: the backend enforces every rule.
- **Theme.** Light, dark or system, chosen in the sidebar or Settings and stored in `localStorage`. A small inline
  script in `app/layout.tsx` applies it before first paint. Colours are CSS variables in `app/globals.css`.
- **Long-running work.** Lists and detail pages poll every 3 seconds while something is `PROCESSING`,
  `PENDING` or `GENERATING`.

## Run locally

Prerequisites: Node 20+, and the backend running on `http://localhost:8080` (see `backend/README.md`).

```bash
npm install
npm run dev          # http://localhost:3000
```

To use a different backend, copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL`. The backend must
list this site's origin in `CORS_ALLOWED_ORIGINS`.

## Production build

```bash
npm run build && npm run start                                   # Node server on :3000
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t learnmind/web .
```

`NEXT_PUBLIC_API_URL` is compiled into the browser bundle, so it is set at build time. For the refresh cookie to
work, serve the site and the API from the same site (for example `app.example.com` and `api.example.com`) over
HTTPS, and set `COOKIE_SECURE=true` on the backend.

For an integrated production-like run with the backend, use `docker compose` from the repository root.
