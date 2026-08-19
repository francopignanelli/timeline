# Timeline — Cost Model & Safeguards

**Hard cap: USD $5/month (AWS + any paid external service). Development target: ~$0/month.**
Nothing below is deployed until the Phase 3 cost review is explicitly approved by the user.

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
- **Safeguards**: Lambda never invokes itself or other Lambdas; no async event sources; reserved concurrency cap (e.g. 10) on the dev function; bounded SDK retries.
- **Deferrable?** No (backend phase).

### DynamoDB
- **Purpose**: all application data.
- **Expected dev usage**: a few thousand requests/month; MBs of storage.
- **Pricing**: on-demand ~$0.625/M writes, ~$0.125/M reads; 25 GB storage always free. Dev: $0.
- **Risks**: none realistic at this scale (no scans in any access pattern).
- **Safeguards**: on-demand billing; all queries key-bounded per DATA_MODEL; pagination caps.
- **Deferrable?** No (backend phase). **Contains user data — never destroy without explicit confirmation.**

### CloudWatch Logs
- **Purpose**: Lambda/API logs for debugging.
- **Expected dev usage**: MBs/month.
- **Pricing**: 5 GB ingest free/month always. Dev: $0.
- **Risks**: unbounded retention accumulating storage; noisy debug logging.
- **Safeguards**: 7-day retention on all project log groups (set in CDK); concise structured logs; no request-body logging.
- **Deferrable?** Comes automatically with Lambda; retention configured from day one.

### Deferred services (not in MVP — each needs its own COST NOTICE before introduction)
- **S3** (media uploads): future top cost vector — will require size/MIME limits and lifecycle rules. **Would contain user uploads — never destroy without confirmation.**
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
