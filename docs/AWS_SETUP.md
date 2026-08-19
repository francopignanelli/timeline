# Timeline — AWS Setup (user-involved steps, Phase 3)

The user currently uses AWS via the **web console only**. CDK deployments require programmatic credentials, so Phase 3 includes a one-time guided setup. **Nothing here happens until the Phase 3 cost review is approved.** No secrets are ever pasted into chat, committed, or written into docs.

## Checklist (each step will be guided interactively when we get there)

### 1. Billing guardrails (console, ~5 min, free)
- Create an AWS Budget: monthly, $5, email alerts at $1 / $3 / $4 / $5.
- Confirm billing alert emails arrive at an address the user actually reads.
- Note: budgets **warn**, they don't stop resources — technical safeguards live in the CDK stack (see COSTS.md).

### 2. Developer identity (console, ~10 min, free)
- Recommended: **IAM Identity Center** (SSO) with a permission set for the dev account → short-lived credentials via `aws configure sso`. Fallback if Identity Center feels heavy for a solo account: an IAM user (console + access key) with MFA — key stored only in the local AWS CLI profile, never in the repo.
- Either way: the root user gets MFA and is never used for daily work.

### 3. AWS CLI (local machine, ~10 min, free)
- Install AWS CLI v2 for Windows; configure profile `timeline-dev` with region `us-east-1`.
- Verify: `aws sts get-caller-identity --profile timeline-dev` returns the expected account.

### 4. CDK bootstrap (one command, effectively $0)
- `npx cdk bootstrap` with the profile — creates the staging bucket/roles CDK needs. Cost: cents-level at most (tiny S3 storage).

### 5. First deployment (after explicit approval)
- `cdk deploy` of the dev stack: Cognito User Pool, HTTP API, Lambda, DynamoDB table, log groups with 7-day retention, tags `project=timeline env=dev`.
- Verification pass together: resources exist in us-east-1, throttling and retention visible, a test signup + authenticated API call works.

### Cleanup path
- `cdk destroy` removes the dev stack. DynamoDB data is user data once real content exists — destruction requires explicit user confirmation per CLAUDE.md.
