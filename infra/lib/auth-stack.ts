import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';

/**
 * Cognito User Pool for authentication only (DECISIONS #8, #18; SECURITY.md).
 * `username` and `displayName` are also stored as Cognito attributes so
 * registration data isn't lost before Phase 5's DynamoDB profile exists;
 * Phase 5 seeds the real User item from these on first authenticated call.
 * Dev stack — RemovalPolicy.DESTROY is intentional (no real users yet).
 */
export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'timeline-dev-users',
      selfSignUpEnabled: true,
      signInAliases: { email: true, username: false },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
        fullname: { required: false, mutable: true },
      },
      customAttributes: {
        username: new cognito.StringAttribute({ minLen: 3, maxLen: 30, mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfa: cognito.Mfa.OFF,
      email: cognito.UserPoolEmail.withCognito(),
      removalPolicy: RemovalPolicy.DESTROY,
      deletionProtection: false,
    });

    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      generateSecret: false,
      authFlows: { userSrp: true },
      disableOAuth: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      preventUserExistenceErrors: true,
      // Explicit read/write attribute allowlists (email, fullname, custom:username) made
      // Cognito reject client creation ("Invalid write attributes specified") for reasons
      // not surfaced in the API error; omitted in favor of the schema defaults (all
      // standard non-immutable + custom attributes), acceptable since this is a
      // first-party app client we fully control, not a third-party integration.
    });

    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId });
    new CfnOutput(this, 'Region', { value: this.region });
  }
}
