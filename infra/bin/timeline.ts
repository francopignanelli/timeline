import { App, Tags } from 'aws-cdk-lib';
import { AuthStack } from '../lib/auth-stack';
import { ApiStack } from '../lib/api-stack';

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

// Local dev is always allowed; the hosted frontend origin(s) are added here
// once a deploy target exists (e.g. after creating the Netlify site).
const corsOrigins = ['http://localhost:5173'];

const authStack = new AuthStack(app, 'TimelineDevAuth', { env });
new ApiStack(app, 'TimelineDevApi', {
  env,
  userPool: authStack.userPool,
  userPoolClientId: authStack.userPoolClient.userPoolClientId,
  corsOrigins,
});

Tags.of(app).add('project', 'timeline');
Tags.of(app).add('env', 'dev');
