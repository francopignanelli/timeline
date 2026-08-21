import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';

export interface AuthStackProps extends StackProps {
  /** Every origin OAuth is allowed to redirect back to after a federated sign-in. */
  corsOrigins: string[];
}

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
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
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
      // OAuth (authorization-code redirect) is what a federated provider like
      // Google needs — email/password sign-in still goes through SRP above,
      // untouched; this only adds the second path, it doesn't replace the first.
      disableOAuth: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: props.corsOrigins,
        logoutUrls: props.corsOrigins,
      },
      // COGNITO (the existing SRP path) always stays available; GOOGLE joins
      // this list in a follow-up deploy once a Google OAuth client exists
      // and its credentials are in SSM (docs/AWS_SETUP.md, guided steps).
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
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

    /*
     * A Cognito-hosted domain is required for any OAuth/federated redirect —
     * there's no way around it, even though this app has no other use for
     * Hosted UI. The prefix embeds the account id so it's unique without
     * guessing (domain prefixes are unique across ALL of Cognito, globally).
     */
    this.userPoolDomain = this.userPool.addDomain('AuthDomain', {
      cognitoDomain: { domainPrefix: `timelines-dev-${this.account}` },
    });

    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId });
    new CfnOutput(this, 'Region', { value: this.region });
    new CfnOutput(this, 'HostedUiDomain', {
      value: this.userPoolDomain.baseUrl(),
      description: 'The Google OAuth redirect URI is this domain + /oauth2/idpresponse',
    });
  }
}
