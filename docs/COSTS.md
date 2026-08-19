# Timeline — Cost Model & Safeguards

**Hard cap: USD $5/month (AWS + any paid external service). Development target: ~$0/month.**
Phases 3–7 are deployed (foundation, Cognito auth, DynamoDB + Lambdalith with full CRUD, and S3 media uploads), all at **$0 actual cost** (see below). Remaining backlog items (sharing, public timelines, hosting, any AI feature) stay gated behind their own COST NOTICE.

## Actual cost so far (Phases 3–7, live)

- **AWS Budget**: free (budgets/alerts have no charge).
- **IAM Identity Center**: free (single-region instance chosen specifically to avoid the customer-managed KMS key multi-region defaults to — see DECISIONS #18).
- **CDK bootstrap stack** (`CDKToolkit`, us-east-1): one small S3 staging bucket, empty — a few cents/month at worst, effectively $0 at near-zero size.
- **Cognito User Pool** (`TimelineDevAuth`, deployed 2026-08-19): free tier, 2 test users registered (across two sessions of live verification). $0.
- **API stack** (`TimelineDevApi`, deployed 2026-08-19, redeployed 2026-08-19 for Phase 6 routes): DynamoDB table `timeline-main` (on-demand, ~10 items), 1 Lambda function bundling the full Hono app (Users/Timelines/Milestones/Stages/links, ~644 kB bundled), 1 HTTP API with JWT authorizer, 1 CloudWatch log group (7-day retention). Live-tested end-to-end across both phases (auth, timeline CRUD, milestone/stage create/edit/delete/link/unlink, transactional delete cascade — all verified via `aws dynamodb scan`). $0, well within always-free tiers.
- **S3 media bucket** (`TimelineDevApi/MediaBucket`, deployed 2026-08-19): private, ~1 test object. $0. Caps and safeguards below.
- **Nothing else deployed.**

## Expected MVP monthly cost: **$0.00** (realistic worst case < $0.50)

Single developer, low request volumes, tiny data. Every chosen service is serverless/pay-per-use with a free tier that dwarfs dev usage.

## Service-by-service

### Amazon Cognito
- **Purpose / why needed**: authentication (register, login, verify, recover) — building auth ourselves would be worse *and* not cheaper.
- **Expected dev usage**: 1–3 users.
- **Pricing**: free tier covers ~10,000 MAU on current pricing (50,000 MAU on pools using the Lite tier). Dev usage: $0.
- **Unexpected-cost risks**: essentially none at this scale; advanced security features (not enabled) are the paid add-on.
- **Safeguards**: no advanced security features; built-in email sender (free, ~50 emails/day cap — fine for dev; SES only if production ever needs it).
- **Deferrable?** No — auth is MVP core (but it comes after the local-first canvas phases).

### API Gateway (HTTP API)
- **Purpose**: HTTPS entry point + JWT validation + throttling.
- **Expected dev usage**: well under 100k requests/month.
- **Pricing**: $1.00/million requests (first 1M/month free for 12 months on new accounts). Dev: $0–$0.10.
- **Risks**: runaway client retry loops.
- **Safeguards**: stage throttling (20 rps / burst 50); TanStack Query retry limits; no polling loops in the app.
- **Deferrable?** No (needed when the backend phase starts).

### AWS Lambda
- **Purpose**: the API compute.
- **Expected dev usage**: same order as API requests; 256 MB, <500 ms typical.
- **Pricing**: always-free 1M requests + 400k GB-s/month — dev usage rounds to $0.
- **Risks**: infinite recursion/retry storms.
- **Safeguards**: Lambda never invokes itself or other Lambdas; no async event sources; bounded SDK retries. Reserved concurrency was planned but isn't set — this account's total Lambda concurrency limit is 10 (`aws lambda get-account-settings`), and AWS rejects reserving any amount below its required 10-unreserved floor. API Gateway throttling (below) and TanStack Query's bounded retries cover the same risk (DECISIONS #24).
- **Deferrable?** No (backend phase).

### DynamoDB
- **Purpose**: all application data.
- **Expected dev usage**: a few thousand requests/month; MBs of storage.
- **Pricing**: on-demand ~$0.625/M writes, ~$0.125/M reads; 25 GB storage always free. Dev: $0.
- **Risks**: none realistic at this scale (no scans in any access pattern).
- **Safeguards**: on-demand billing; all queries key-bounded per DATA_MODEL; pagination caps; `RemovalPolicy.RETAIN` on the table (DECISIONS #23) so a `cdk destroy` can't silently wipe it.
- **Deferrable?** No (backend phase). **Contains user data — never destroy without explicit confirmation.**

### CloudWatch Logs
- **Purpose**: Lambda/API logs for debugging.
- **Expected dev usage**: MBs/month.
- **Pricing**: 5 GB ingest free/month always. Dev: $0.
- **Risks**: unbounded retention accumulating storage; noisy debug logging.
- **Safeguards**: 7-day retention on all project log groups (set in CDK); concise structured logs; no request-body logging.
- **Deferrable?** Comes automatically with Lambda; retention configured from day one.

### Amazon S3 (media uploads) — LIVE as of Phase 7 (cost review approved 2026-08-19)
- **Purpose**: image and file attachments on milestones.
- **Expected dev usage**: a handful of MB.
- **Pricing**: $0.023/GB-month storage; free tier 5 GB + 20k GET / 2k PUT per month. Dev usage: **$0**; realistic worst case well under $0.50/mo.
- **Risks**: unbounded storage growth; abuse via large or many uploads; egress.
- **Safeguards**: server-enforced size caps (images ≤5 MB, files ≤10 MB) and a narrow MIME allowlist, both checked **before** a presigned URL is issued and pinned into the signature; ≤50 blocks per milestone bounds attachments per item; presigned URLs are short-lived (5 min upload / 15 min view); bucket is private with all public access blocked; `abortIncompleteMultipartUploadAfter: 1 day` reclaims failed uploads.
- **Known gap**: no garbage collection of objects when a milestone/block is deleted, and uploads abandoned before save are orphaned. Bounded and negligible at these caps; revisit with a lifecycle sweeper if storage ever shows up in the budget.
- **Deferrable?** No longer — user-requested and approved. **Contains user uploads — `RemovalPolicy.RETAIN`; never destroy without explicit confirmation.**

### Deferred services (not in MVP — each needs its own COST NOTICE before introduction)
- **CloudFront + S3 hosting** (deployed frontend): CloudFront has 1 TB/month always-free transfer; reviewed at hosting phase.
- **SES** (invitation/production email), **Route 53 / custom domain** (~$12+/yr — exceeds budget shape, deferred indefinitely), **any AI service** (none approved; disabled by default).
- **CDK bootstrap** (Phase 3): creates an S3 staging bucket + IAM roles — effectively $0 (tiny storage), noted for completeness.

## Budget protection (set up in Phase 3, guided in AWS_SETUP.md)

- One AWS Budget: $5/month with alert thresholds at **$1, $3, $4, $5** (email). First two budgets are free.
- Billing alerts warn — they do **not** stop resources. That's why the technical safeguards above (throttling, concurrency caps, retention, on-demand billing, no always-on compute) exist independently.
- Monthly habit: glance at Cost Explorer / billing home when starting a session after deployment exists.

## Standing rules

- No always-on compute, NAT gateways, VPC endpoints, load balancers, provisioned capacity, or paid observability.
- Every infrastructure change updates this file as part of Definition of Done.
- Any action that could plausibly exceed "negligible" gets a COST NOTICE before execution.
