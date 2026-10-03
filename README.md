# AI Guruz

An AI-powered learning operating system: it turns uploaded documents into structured knowledge, researches
any topic, plans a beginner-to-expert curriculum, assesses the learner after every module and reshapes the
path around what they actually know. Built from `LearnMind_AI_Combined_PRD_v2` (the product has since been renamed from LearnMind AI to AI Guruz).

## What is in this repository

Each top-level folder is self-contained (its own dependencies, config, README and ignore file) so it can be
moved to its own repository unchanged.

| Folder | What it is | Stack | README |
|---|---|---|---|
| [backend/](backend/) | API gateway + 7 microservices | Java 21, Spring Boot 4, MongoDB | [backend/README.md](backend/README.md) |
| [web/](web/) | Public website and browser app | Next.js 16, React 19, Tailwind 4 | [web/README.md](web/README.md) |
| [mobile/](mobile/) | iOS and Android app | Expo SDK 57, React Native | [mobile/README.md](mobile/README.md) |
| [lambdas/](lambdas/) | Document text extraction for AWS | Python 3.13 | [lambdas/README.md](lambdas/README.md) |
| [deploy/](deploy/) | Free public deployment on one server (Oracle Cloud VM, Caddy HTTPS, Groq AI) | Docker Compose | [deploy/README.md](deploy/README.md) |
| [infra/](infra/) | How the pieces map onto AWS | – | [infra/README.md](infra/README.md) |

## Architecture

```
  Web (Next.js)        Mobile (Expo: iOS / Android)
        \                    /
         \   HTTPS, JSON    /
          v                v
        +--------------------+
        |    API gateway     |  routing, CORS, rate limiting          :8080
        +--------------------+
   /api/auth  /api/documents  /api/analyses  /api/curricula  /api/assessments  /api/learning  /api/analytics
       |            |              |              |                |                 |              |
   +-------+   +----------+   +----------+   +------------+   +------------+   +----------+   +-----------+
   | auth  |   | document |   | analysis |   | curriculum |   | assessment |   | learning |   | analytics |
   | :8101 |   |  :8102   |   |  :8103   |   |   :8104    |   |   :8105    |   |  :8106   |   |   :8107   |
   +-------+   +----------+   +----------+   +------------+   +------------+   +----------+   +-----------+
       |            |              |              |                |                 |              ^
       +------------+--------------+------ MongoDB (one database per service) ------+              |
                                                                                                    |
                         every service publishes audit / activity events ---------------------------+
```

The agents named in the PRD live in these services:

| PRD agent | Where | What it does |
|---|---|---|
| Research Agent | curriculum-service | Gathers background on the topic from Wikipedia and keeps the source links |
| Planner Agent | curriculum-service | Plans 6–9 modules from the starting level to expert |
| Content Generator | curriculum-service | Writes each lesson the first time the learner opens it |
| Assessment Agent | assessment-service | Writes a quiz per module and grades written answers |
| Knowledge Evaluator | learning-service | Updates per-concept mastery after every quiz |
| Learning Path Optimizer | learning-service | Decides advance / remedial / lateral and has the curriculum adapted |
| Analytics Engine, Audit Service | analytics-service | Dashboards and the audit log, built from events |

The adaptive loop: **open module → lesson → quiz → per-concept score → decision → path changes → next module**.
A score under 50% inserts a reinforcement module that must be passed; 50–80% (or one concept clearly missed)
inserts an optional practice detour and unlocks the next module; 80%+ advances.

## Run everything locally (no cloud, no Docker)

Prerequisites: JDK 21+, Maven, Node 20+. Optional: [Ollama](https://ollama.com) with `ollama pull llama3.2:3b`
for real AI output (without it the platform still runs, using built-in extractive fallbacks).

```powershell
# 1. Backend: MongoDB + gateway + 7 services        -> http://localhost:8080
cd backend
.\scripts\start-local.ps1

# 2. Website and web app                            -> http://localhost:3000
cd web
npm install
npm run dev

# 3. Mobile app (Expo Go, emulator or simulator)
cd mobile
npm install
npx expo start
```

Sign in with a seeded demo account (password `Demo@1234`):
`admin@demo.aiguruz.com`, `teacher@…`, `librarian@…`, `researcher@…`, `student@…`.

Stop the backend with `backend\scripts\stop-local.ps1`.

## Run it integrated, production-like, on one machine

This is the closest local equivalent of the production layout: every service in its own container on a
private network, only the gateway and the web app exposed, the `prod` profile active, secrets from an env file.
Requires Docker Desktop.

```bash
cp backend/.env.example backend/.env        # set INTERNAL_API_KEY (openssl rand -hex 32)
docker compose --env-file backend/.env up --build
# web: http://localhost:3000    api: http://localhost:8080
```

Point the mobile app at it with `EXPO_PUBLIC_API_URL` (see [mobile/README.md](mobile/README.md)).
What changes between this and real production is listed in [infra/README.md](infra/README.md).

## Roles

Authentication and authorization are enforced in the backend on every request (signed token, tenant check,
role check). The web and mobile apps hide what a role cannot use, but never rely on that.

| Capability | Student | Researcher | Teacher | Librarian | Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Own documents, analyses, learning paths, quizzes, analytics | ✓ | ✓ | ✓ | ✓ | ✓ |
| Read the institution library (shared documents) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Share own documents to the library | | | ✓ | ✓ | ✓ |
| See, share or delete any document in the institution | | | | ✓ | ✓ |
| See learners' paths and institution analytics; see the join code | | | ✓ | | ✓ |
| Manage users and roles, regenerate the join code, read the audit log | | | | | ✓ |

Data never crosses institutions: every record carries a tenant id and every query filters on it.

## PRD coverage

| PRD item | Status |
|---|---|
| Authentication, RBAC, multi-tenancy, audit logs | Implemented |
| Document upload, summaries, mind maps, deep analysis, exam prep | Implemented |
| Topic input and autonomous research | Implemented (Wikipedia as the trusted source) |
| Curriculum planner, module generation, quiz/task per module | Implemented |
| Knowledge-state evaluation, dynamic next-module planning, progress persistence | Implemented |
| Personalised recommendations, learner knowledge graph, analytics dashboard | Implemented |
| Success metrics (generation time, analysis time, confidence, path divergence) | Measured and shown on the Analytics page |
| Future roadmap (semantic search, SSO, collaborative learning, vector DB, predictive analytics) | Not built |

## Honest limitations

- **AI speed depends on the model.** On a CPU-only laptop with `llama3.2:3b`, an analysis took about 50 s and a
  curriculum about 200 s in testing. The PRD's 15 s analysis target needs a GPU or the Claude API.
- **Confidence** is reported as *grounding*: the share of an analysis's key terms found in the source document.
  It is a measurable proxy, not a guarantee of correctness.
- **Not exercised here:** the AWS paths (S3 storage, SQS events, the Lambda trigger), the Claude provider (no API
  key on this machine), the Docker images (Docker is not installed on this machine), and the mobile app on a real
  device or emulator (it type-checks and bundles for iOS and Android).
- **Mobile** does not download the original uploaded file; everything else matches the web app.
- The landing page copy in `web/src/content/site.ts` (features, about text) is draft wording; the contact details are the real ones.
