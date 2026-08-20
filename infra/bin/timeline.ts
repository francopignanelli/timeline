import { App, Tags } from 'aws-cdk-lib';
import { AuthStack } from '../lib/auth-stack';
import { ApiStack } from '../lib/api-stack';

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

/*
 * Exact origins allowed to call the API and to PUT to the media bucket.
 * Deliberately an explicit allowlist, not a wildcard: these endpoints carry a
 * user's JWT, so any origin listed here can act as that user (SECURITY.md).
 *
 * Netlify deploy previews (deploy-preview-N--timelinez.netlify.app) are NOT
 * included — each has a distinct origin, and allowing the pattern would mean
 * trusting every branch build.
 */
// Name only — the secret itself lives in SSM, created out-of-band so it
// never enters this repository (docs/AWS_SETUP.md).
const SETLIST_API_KEY_PARAM = '/timeline/dev/setlistfm-api-key';

const corsOrigins = ['http://localhost:5173', 'https://timelinez.netlify.app'];

const authStack = new AuthStack(app, 'TimelineDevAuth', { env });
new ApiStack(app, 'TimelineDevApi', {
  env,
  userPool: authStack.userPool,
  userPoolClientId: authStack.userPoolClient.userPoolClientId,
  corsOrigins,
  setlistApiKeyParam: SETLIST_API_KEY_PARAM,
});

Tags.of(app).add('project', 'timeline');
Tags.of(app).add('env', 'dev');
