# AI Guruz — Backend

Java 21 · Spring Boot 4 · MongoDB · Maven multi-module. One API gateway and seven services, each a separate
deployable with its own database.

## Layout

```
backend/
├── pom.xml                      parent build (versions, module list)
├── libs/common/                 shared library used by every servlet service
│   ├── security/                token verification, CurrentUser, roles, internal-key filter
│   ├── web/                     uniform error responses
│   ├── events/                  audit/activity event publishing (HTTP locally, SQS in production)
│   ├── ai/                      model clients (Ollama, Claude), AiService with offline fallback, text heuristics
│   └── client/                  service-to-service HTTP client that forwards the user's token
├── services/
│   ├── gateway/            :8080   routing, CORS, rate limiting (Spring Cloud Gateway)
│   ├── auth-service/       :8101   users, institutions, login, tokens, roles
│   ├── document-service/   :8102   upload, storage, text extraction, sharing
│   ├── analysis-service/   :8103   summary, mind map, deep analysis, exam prep
│   ├── curriculum-service/ :8104   research, planning, lessons, path changes
│   ├── assessment-service/ :8105   quizzes and grading
│   ├── learning-service/   :8106   mastery, path decisions, knowledge graph, recommendations
│   └── analytics-service/  :8107   event store, dashboards, audit log
├── scripts/                     start-local.ps1, stop-local.ps1
├── Dockerfile                   one image definition, parameterised by service
└── docker-compose.yml           production-like local stack
```

## How the services work together

```
client ──> gateway ──> service            every request carries the user's access token
                         │
assessment ──> curriculum      reads the module to write a quiz        (user token forwarded)
assessment ──> learning        reports the graded quiz                 (/internal, user token + internal key)
learning   ──> curriculum      applies advance / remedial / lateral    (/internal, user token + internal key)
analysis   ──> document        reads the extracted text                (user token forwarded)
all        ──> analytics       audit and activity events               (/internal, internal key)
```

- **Authentication.** auth-service signs short-lived RS256 access tokens (15 min) and publishes the public key at
  `/.well-known/jwks.json`. Every other service verifies tokens itself against that key, so a request that
  bypasses the gateway is still authenticated. Refresh tokens are opaque, single-use (rotated on every refresh)
  and stored only as SHA-256 hashes. Browsers get the refresh token as an `HttpOnly; SameSite=Strict` cookie;
  native clients (header `X-Client: mobile`) get it in the response body and keep it in the device keystore.
- **Authorization.** The token carries the user id, tenant id and role. Services check the tenant on every
  record, ownership where it applies, and the role (`@PreAuthorize` or `CurrentUser.require`). A resource in
  another institution is reported as 404, not 403.
- **Internal endpoints.** Paths under `/internal/**` need the `X-Internal-Key` header and are never routed by the
  gateway. This is why a learner cannot mark a module complete without an assessed quiz.
- **Account protection.** BCrypt (cost 12), lockout for 15 minutes after 5 failed sign-ins, per-address rate
  limits at the gateway (stricter on login and register), identical responses for unknown email and wrong password.
- **AI.** `AiService` calls the configured model and validates its output. If the model is unreachable or returns
  unusable output, the caller's offline fallback is used and the result is flagged (`fallbackUsed`), so the
  platform always works and the UI can say when a result is not model-generated.
- **Long work is asynchronous.** Analyses and curricula return immediately with a `PENDING` / `GENERATING` status;
  clients poll. Lessons and quizzes are generated on first request.

## Run locally (no Docker, no cloud)

Prerequisites: JDK 21 or newer, Maven 3.9+. MongoDB is downloaded into `.local/` on first run if `mongod` is not
installed. Optional: Ollama with `ollama pull llama3.2:3b`.

```powershell
.\scripts\start-local.ps1                     # everything, AI through Ollama
.\scripts\start-local.ps1 -AiProvider mock    # no model: extractive fallbacks only
.\scripts\start-local.ps1 -AiProvider claude  # needs $env:ANTHROPIC_API_KEY
.\scripts\start-local.ps1 -Build              # rebuild jars first
.\scripts\stop-local.ps1                      # stop services and MongoDB
```

The API is at `http://localhost:8080`. Logs are in `.local/logs/`, uploaded files in `.local/storage/`, database
files in `.local/data/`. Demo accounts (`SEED_DEMO=true` in the script): `admin`, `teacher`, `librarian`,
`researcher`, `student` `@demo.aiguruz.com`, password `Demo@1234`.

The script runs each JVM with a 192 MB heap so all eight fit on an 8 GB laptop; pass `-HeapMb 384` if you have
more memory. Starting everything takes one to two minutes.

On macOS or Linux, start MongoDB yourself (`mongod --dbpath .local/data`) and run the jars the same way the
script does, or use Docker Compose below.

### Run or debug a single service

Each service is an ordinary Spring Boot application with working local defaults:

```powershell
mvn -q install -DskipTests -pl libs/common                 # once, and after changing the shared library
mvn spring-boot:run -pl services/curriculum-service
```

Or run its `*Application` class from the IDE. A service needs MongoDB, auth-service (to fetch the token
verification key) and whichever services it calls (see the diagram above). A common setup is
`start-local.ps1`, then stop one service and run that one from the IDE:

```powershell
.\scripts\start-local.ps1
Stop-Process -Id (Get-Content .local\pids\curriculum-service.pid)
# now start CurriculumApplication in the debugger
```

### Tests

```powershell
mvn test
```

Unit tests cover the path optimizer, quiz parsing and offline grading, and the AI fallback logic.

## Run production-like (Docker Compose)

```bash
cp .env.example .env            # set INTERNAL_API_KEY
docker compose up --build       # API on http://localhost:8080
```

Every service runs in its own container with the `prod` profile; only the gateway is published. From the
repository root the same command also starts the web app.

## Configuration

All configuration is environment variables with local defaults; nothing cloud-specific is needed locally.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | per service | HTTP port |
| `MONGODB_URI` | `mongodb://localhost:27017/aiguruz_<service>` | Database of the service (Atlas / DocumentDB URI in production) |
| `SPRING_PROFILES_ACTIVE` | – | `prod` refuses to start with the development internal key |
| `INTERNAL_API_KEY` | development value | Secret for `/internal/**`; must be set in production |
| `JWKS_URI` | `http://localhost:8101/.well-known/jwks.json` | Where services fetch the token verification key |
| `AI_PROVIDER` | `ollama` | `ollama`, `openai` (any OpenAI-compatible API, e.g. Groq), `claude` or `mock` |
| `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL` | Groq URL, –, `llama-3.3-70b-versatile` | OpenAI-compatible provider |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_CONTEXT_TOKENS` | `http://localhost:11434`, `llama3.2:3b`, `8192` | Local model |
| `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` | –, `claude-opus-5-5` | Claude API |
| `EVENTS_MODE`, `EVENTS_QUEUE_URL` | `http` | `sqs` sends events through an SQS queue |
| `STORAGE_MODE`, `STORAGE_LOCAL_DIR`, `STORAGE_S3_BUCKET` | `local`, `./.local/storage` | `s3` stores uploads in S3 |
| `EXTRACTION_MODE` | `inline` | `lambda` leaves extraction to the Python Lambda |
| `RESEARCH_ENABLED` | `true` | `false` keeps curriculum planning fully offline |
| `ADVANCE_THRESHOLD`, `REMEDIAL_THRESHOLD` | `0.8`, `0.5` | Path decision thresholds |
| `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS` | `15`, `14` | Token lifetimes |
| `COOKIE_SECURE` | `false` | `true` behind HTTPS |
| `JWT_PRIVATE_KEY` | – | Base64 PKCS#8 RSA key; empty = generated once and kept in MongoDB |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:8081` | Browser origins the gateway accepts |
| `RATE_LIMIT_PER_MINUTE`, `AUTH_RATE_LIMIT_PER_MINUTE` | `300`, `30` | Gateway limits per client address |
| `TRUST_PROXY` | `false` | `true` when a reverse proxy is the only way in (rate limits then use `X-Forwarded-For`) |
| `*_SERVICE_URL` | localhost ports | Where services find each other |

## API

All paths are served through the gateway. Errors have the shape `{"code": "...", "message": "..."}`.

| Method and path | Who | Purpose |
|---|---|---|
| `POST /api/auth/register` | public | Create an account: personal workspace, new institution, or join with a code |
| `POST /api/auth/login` · `refresh` · `logout` | public | Session management |
| `GET /api/auth/me` · `POST /api/auth/password` | signed in | Profile, change password |
| `GET /api/tenants/me` | signed in | Institution (join code visible to teachers and admins) |
| `POST /api/tenants/me/join-code` | admin | New join code |
| `GET/POST /api/users` · `PATCH /api/users/{id}` | admin | List, create, change role, activate/deactivate |
| `POST /api/documents` (multipart `file`) | signed in | Upload (PDF, DOCX, PPTX, TXT, MD, RTF, HTML, EPUB; 25 MB) |
| `GET /api/documents?scope=mine\|shared\|all` | `all`: librarian, admin | List |
| `GET /api/documents/{id}` · `/text` · `/download` | readers | Metadata, extracted text, original file |
| `PATCH /api/documents/{id}` | owner; sharing needs teacher, librarian or admin | Rename, share, unshare |
| `DELETE /api/documents/{id}` | owner, librarian, admin | Delete |
| `POST /api/analyses` `{documentId, type, regenerate}` | signed in | Start `SUMMARY`, `MIND_MAP`, `DEEP_ANALYSIS` or `EXAM_PREP` |
| `GET /api/analyses?documentId=` · `GET /api/analyses/{id}` | owner | Results (poll while `PENDING`) |
| `POST /api/curricula` `{topic, goal, level}` | signed in | Start a learning path |
| `GET /api/curricula?scope=tenant` | `tenant`: teacher, admin | List |
| `GET /api/curricula/{id}` · `DELETE` | owner (teachers and admins may read) | Path and modules |
| `GET /api/curricula/{id}/modules/{moduleId}` | owner | Lesson (written on first open) |
| `POST /api/assessments` `{curriculumId, moduleId}` | owner | Get or create the quiz for a module |
| `POST /api/assessments/{id}/submit` | owner | Grade, update mastery, adapt the path |
| `GET /api/learning/knowledge-graph?curriculumId=` | owner | Modules, concepts and mastery |
| `GET /api/learning/progress` · `recommendations` | signed in | Progress per path, next steps |
| `GET /api/analytics/dashboard?scope=me\|tenant&days=` | `tenant`: teacher, admin | Metrics |
| `GET /api/audit-logs?page=&size=&type=` | admin | Audit log |

## Scaling notes

- Services are stateless; run several instances of each behind a load balancer. The gateway's rate limiter keeps
  its counters in memory, so with more than one gateway instance move rate limiting to the load balancer or WAF.
- Background work (analysis, curriculum generation, inline extraction) runs on small in-process thread pools. A job
  in flight is lost if its instance stops; the record then stays `PENDING` and the user can regenerate it. For
  heavy load, move these onto a queue with workers.
- The analytics dashboard aggregates up to 20,000 events per request in memory. Past that, add scheduled rollups.
