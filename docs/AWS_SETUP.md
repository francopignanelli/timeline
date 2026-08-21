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

## Google Sign-In (Phase 8, in progress)

**Status**: Cognito is ready to federate — a Hosted UI domain and OAuth support on the app client were deployed 2026-08-21 (DECISIONS #58). What's still needed is a Google OAuth client, which only the account owner can create.

### 6. Google Cloud OAuth client (console, ~15 min, free)
1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project (or reuse one) — any name.
2. **APIs & Services → OAuth consent screen**: User type **External**. App name: `Timelines`. Support email: your own. Leave it in **Testing** mode for now (no Google review needed while it's just you and invited testers); scopes `email`, `profile`, `openid` are the non-sensitive defaults and need no extra justification.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**. Application type: **Web application**. Name: `Timelines (dev)`.
   - **Authorized JavaScript origins**: `http://localhost:5173` and `https://timelinez.netlify.app`
   - **Authorized redirect URIs**: exactly —
     ```
     https://timelines-dev-990863603580.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
     ```
     (This is Cognito's own callback endpoint, not the app's — Cognito redirects on to the app's actual origin afterward, via the `callbackUrls` already configured on the User Pool Client.)
4. Google shows a **Client ID** and **Client Secret**. Send me the Client ID (not secret) — and store the secret yourself, directly, so it never enters this chat's history:
   ```
   aws ssm put-parameter --name /timeline/dev/google-oauth-client-secret --type SecureString --value "<paste secret here>" --profile timeline-dev --region us-east-1
   ```

### 7. Wire up the identity provider (once the above is done)
- Add a `UserPoolIdentityProviderGoogle` construct (client ID as a plain prop, secret pulled from SSM the same way `SETLIST_API_KEY_PARAM` is), add `GOOGLE` to the User Pool Client's `supportedIdentityProviders`, map Google's `email`/`given_name`/`family_name` to the pool's standard attributes.
- Frontend: a "Sign in with Google" button (`signInWithRedirect({ provider: 'Google' })`), plus a first-login step for a federated user with no `custom:username` yet — auto-derived from their email's local part (slugified, de-duplicated), shown as an editable, one-time confirmation rather than locked in silently.
