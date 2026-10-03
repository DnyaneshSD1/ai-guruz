# LearnMind AI — Production on AWS

The code runs the same way everywhere; production differs from a laptop only in configuration. This page maps
each local piece to its AWS counterpart and lists the settings that change. It is a deployment guide, not
infrastructure-as-code: no Terraform or CloudFormation for the services is included yet (the Lambda has a SAM
template in `lambdas/`).

## Local to production

| Concern | Local (`start-local.ps1`) | Production-like (`docker compose`) | AWS |
|---|---|---|---|
| Services | 8 JVM processes | 8 containers, private network | ECS Fargate services (or EKS), images in ECR |
| Entry point | gateway on :8080 | gateway on :8080 | Application Load Balancer + AWS WAF → gateway |
| Service discovery | localhost ports | container names | ECS Service Connect / Cloud Map names in `*_SERVICE_URL` |
| Database | portable MongoDB | `mongo` container | MongoDB Atlas (or Amazon DocumentDB), one database per service |
| File storage | `.local/storage` | Docker volume | S3 (`STORAGE_MODE=s3`) |
| Text extraction | in the document service | in the document service | Python Lambda on S3 upload (`EXTRACTION_MODE=lambda`) |
| Events | HTTP to analytics | HTTP to analytics | SQS queue (`EVENTS_MODE=sqs`) |
| AI | Ollama or offline fallback | Ollama on the host | Claude API (`AI_PROVIDER=claude`) |
| Secrets | development defaults | `.env` file | Secrets Manager → task environment |
| Web | `npm run dev` | `web` container | the same container on ECS, or any Node host, behind CloudFront |
| Mobile | Expo dev server | Expo dev server | App Store / Play Store builds from EAS |

```
                Route 53
                   │
     CloudFront ───┴─── ALB + WAF  (HTTPS)
         │                  │
     web (ECS)          gateway (ECS)
                            │  private subnets
     auth · document · analysis · curriculum · assessment · learning · analytics   (ECS services)
        │        │                                                       ▲
        │        └── S3 ──> Lambda (document-extractor) ──callback──┘     │
        └────────────── MongoDB Atlas / DocumentDB ──────────────── SQS ──┘
```

## Settings that must change for production

| Setting | Value |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` (services refuse to start with the development internal key) |
| `INTERNAL_API_KEY` | a random secret, the same for all services and the Lambda |
| `JWT_PRIVATE_KEY` | an RSA key from Secrets Manager (otherwise the key is generated and stored in the auth database) |
| `MONGODB_URI` | per service, with credentials and TLS |
| `COOKIE_SECURE` | `true` |
| `CORS_ALLOWED_ORIGINS` | the real web origin only |
| `SEED_DEMO` | `false` (never seed demo accounts in production) |
| `AI_PROVIDER`, `ANTHROPIC_API_KEY` | `claude` and the key |
| `STORAGE_MODE`, `STORAGE_S3_BUCKET`, `EXTRACTION_MODE` | `s3`, the bucket, `lambda` |
| `EVENTS_MODE`, `EVENTS_QUEUE_URL` | `sqs`, the queue URL |
| `JWKS_URI`, `*_SERVICE_URL` | internal service addresses |
| Web build arg `NEXT_PUBLIC_API_URL`, mobile `EXPO_PUBLIC_API_URL` | the public HTTPS API address |

IAM: the document service needs read/write on the documents bucket; every service needs `sqs:SendMessage` on the
events queue; the analytics service needs receive/delete on it; the Lambda needs read on the bucket. Credentials
come from the task and function roles (the AWS SDK default chain), so no keys are configured.

## Before going live

- Put the gateway behind HTTPS and keep every other service in private subnets; only the load balancer is public.
- Serve the web app and the API from the same site (for example `app.` and `api.` of one domain) so the
  `SameSite=Strict` refresh cookie is sent.
- Move rate limiting to WAF when running more than one gateway instance (the built-in limiter is per instance).
- Add centralized logs and alarms (CloudWatch), database backups, and health checks on `/actuator/health`.
- Exercise the cloud paths end to end in a staging account: S3 storage, the Lambda callback, SQS events and the
  Claude provider were written against the SDKs and compile, but have not been run from this workspace.

## The 99.5% uptime target

Run at least two instances of every service across two availability zones, use a replicated database cluster, and
let the load balancer health checks replace unhealthy tasks. Services are stateless, so this needs no code changes.
