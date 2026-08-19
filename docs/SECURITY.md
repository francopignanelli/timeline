# Timeline — Security Model

## Threat assumptions

- The client is untrusted: any request can be forged with arbitrary bodies, ids, and headers. Authorization exists only in the backend.
- Tokens can leak via logs — so tokens are never logged.
- User content is untrusted input (stored text may attempt XSS on render).
- The AWS account is single-developer; the main account-level risks are credential leakage and cost abuse.

## Authentication

- Amazon Cognito User Pool: email + password, email verification required, password recovery, self-signup enabled.
- Custom-branded auth screens call Cognito via the Amplify JS auth category (SRP flow) — no credentials ever touch our backend or logs.
- SPA app client: no client secret, Authorization-code-style token handling in the browser; refresh tokens rotated; access token lifetime 1h.
- Password policy: min 8 chars, mixed case + number. MFA: off in MVP (personal dev project), architecture supports enabling TOTP later.
- Social login (Google/Apple): deferred; Cognito federation slots in without app-side token changes.

## Authorization

- Enforced in the Lambda service layer on every request; API Gateway's JWT authorizer only proves identity.
- MVP rule: strict ownership (`ownerId === jwt.sub`) on Timelines, Milestones, Stages; link operations require owning both ends.
- 404 is returned for "exists but not yours" — no resource-existence leaks.
- Deferred membership model (designed in DATA_MODEL/PRODUCT): OWNER/EDITOR/VIEWER roles on Timelines and Milestones; visibility checks for SHARED/UNLISTED/PUBLIC; mentions grant no permissions. The service layer is the single widening point.

## Input validation & content safety

- Every request body/query validated with shared zod schemas (types, lengths, enum membership, ISO date validity, block count limits).
- Hard caps in MVP: title ≤ 200 chars, description/bio ≤ 2000, TEXT block ≤ 10 000, blocks per milestone ≤ 50 — bounds DynamoDB items and abuse.
- Rendering: React's default escaping everywhere; no `dangerouslySetInnerHTML` for user content; user-provided URLs (website field) validated as http(s) and rendered with `rel="noopener noreferrer"`.

## Transport, CORS, headers

- HTTPS everywhere (API Gateway + Cognito endpoints are TLS-only).
- CORS: explicit allowlist (`http://localhost:5173` in dev; deployed origin added later), only needed methods/headers, no `*`.
- Frontend (when hosted later): CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `frame-ancestors 'none'` via CloudFront response headers — documented now, applied at hosting phase.

## Rate limiting & abuse

- API Gateway stage throttling: ~20 req/s rate, burst 50 (far above dev needs, far below abuse levels) — also a cost safeguard.
- Cognito has built-in adaptive throttling for auth attempts.

## IAM & secrets

- Lambda execution role: scoped to `timeline-main` table + its GSI (Query/Get/Put/Update/Delete/BatchGet/TransactWrite) and its own log group. No wildcard resources.
- Developer credentials: created during the AWS phase (see AWS_SETUP.md); never committed, never pasted into chat/docs; local `.env` files gitignored; frontend config carries only public identifiers (user pool id, client id, API URL) which are not secrets.
- No application secrets exist in MVP (no third-party API keys). If one appears later: SSM Parameter Store (free standard tier), never env-committed.

## Logging & audit

- Structured JSON logs: requestId, route, userId (sub), outcome, latency. Never tokens, passwords, or full request bodies.
- CloudWatch retention 7 days (dev). Errors log stack traces server-side only; clients get opaque 500s.

## S3 uploads (live as of Phase 7 — the pre-committed rules, now implemented)

- **Private bucket**, `BlockPublicAccess.BLOCK_ALL`, SSE-S3 encryption, `enforceSSL`. Verified: anonymous GET returns 403. There is no unsigned path to an object.
- **Presigned URLs only.** Upload URLs live 5 minutes, view URLs 15. The upload signature pins `Content-Type` and `Content-Length`, so a client cannot upload something other than what the server validated.
- **Server-side MIME allowlist + size caps enforced before signing** — images ≤5 MB, files ≤10 MB. `image/svg+xml` is deliberately excluded: SVG is an executable document and these objects are served from a domain we presign for. Executables are not on any list.
- **Ownership from the key.** Keys are minted `u/<userId>/<ulid><ext>`; a view/download request for a key outside the caller's own prefix returns 404 (no existence leak). Key shape is schema-validated, so `../` traversal is rejected at the boundary.
- **FILE downloads force `Content-Disposition: attachment`**, so a document can never render inline as an active document in the browser.
- Known gap (documented, not fixed): objects are not garbage-collected when a milestone or block is deleted, and an upload abandoned before save is orphaned. Bounded and trivial at current caps/usage; a sweeper is the answer if it ever matters.

## Embedded third-party content

YouTube blocks store only a validated 11-character video id — never a pasted URL. The embed `src` is **rebuilt** from that id at render time against `youtube-nocookie.com`, so a hostile string can never reach an iframe. Host validation is exact-match (a lookalike like `youtube.com.evil.example` is rejected) and covered by unit tests.
