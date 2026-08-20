import * as path from 'node:path';
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type * as cognito from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';

export interface ApiStackProps extends StackProps {
  userPool: cognito.UserPool;
  userPoolClientId: string;
  /** Every origin allowed to call the API — dev (localhost) and, once deployed, the hosted frontend. */
  corsOrigins: string[];
}

/**
 * DynamoDB single table + Lambdalith (Hono) + API Gateway HTTP API with the
 * Cognito JWT authorizer (DATA_MODEL.md, API.md, ARCHITECTURE.md). Scoped to
 * Phase 5: Users + Timelines only — Milestones/Stages routes arrive in
 * Phase 6, the table design already accommodates them.
 */
export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // RemovalPolicy.RETAIN is a standing safeguard (CLAUDE.md: never destroy
    // DynamoDB data without explicit confirmation) — unlike the disposable
    // dev Cognito pool, this table is meant to survive a `cdk destroy`.
    const table = new dynamodb.Table(this, 'Table', {
      tableName: 'timeline-main',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    /*
     * Media bucket (Phase 7, user-approved cost review). Fully private —
     * all access is via short-lived presigned URLs minted by the Lambda after
     * an ownership check; there is no bucket policy granting public reads.
     * RETAIN for the same reason as the table: it holds user uploads, which
     * CLAUDE.md forbids destroying without explicit confirmation.
     */
    const mediaBucket = new s3.Bucket(this, 'MediaBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      cors: [
        {
          allowedOrigins: props.corsOrigins,
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        // Cost safeguard: reclaim storage from uploads that never completed.
        { abortIncompleteMultipartUploadAfter: Duration.days(1) },
      ],
    });

    const logGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const fn = new NodejsFunction(this, 'ApiFunction', {
      entry: path.join(__dirname, '../../apps/api/src/lambda.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      // No reservedConcurrentExecutions: this account's total Lambda concurrency
      // limit is 10 (AWS default for new/unverified accounts), and AWS requires
      // >=10 to stay unreserved — reserving any amount here is rejected outright.
      // Cost-abuse protection instead comes from API Gateway throttling
      // (20 rps / burst 50, below) plus TanStack Query's bounded retries.
      logGroup,
      environment: {
        TABLE_NAME: table.tableName,
        CORS_ORIGIN: props.corsOrigins.join(','),
        MEDIA_BUCKET: mediaBucket.bucketName,
      },
    });
    table.grantReadWriteData(fn);
    // Least privilege: the function presigns and deletes objects, and never
    // needs to list the bucket or touch its configuration.
    mediaBucket.grantReadWrite(fn);

    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      corsPreflight: {
        allowOrigins: props.corsOrigins,
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
        ],
        allowHeaders: ['Authorization', 'Content-Type'],
        maxAge: Duration.days(1),
      },
    });

    // Escape hatch: the HttpApi L2 construct has no first-class throttle prop
    // for the default stage. Matches COSTS.md's stage throttling safeguard.
    const cfnStage = httpApi.defaultStage!.node.defaultChild as apigwv2.CfnStage;
    cfnStage.defaultRouteSettings = { throttlingRateLimit: 20, throttlingBurstLimit: 50 };

    /*
     * Access logs: method, route and status for every request. Added because
     * 4xx responses never reach the Lambda's own logs, which left failures
     * that were rejected at the gateway (or returned as a clean 4xx) with no
     * server-side trace at all — impossible to diagnose from the outside.
     *
     * Deliberately excludes request bodies and headers: no tokens, no user
     * content (SECURITY.md). 7-day retention like the function's log group.
     */
    const accessLogGroup = new logs.LogGroup(this, 'ApiAccessLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    cfnStage.accessLogSettings = {
      destinationArn: accessLogGroup.logGroupArn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        method: '$context.httpMethod',
        path: '$context.path',
        routeKey: '$context.routeKey',
        status: '$context.status',
        integrationStatus: '$context.integrationStatus',
        integrationError: '$context.integrationErrorMessage',
        authorizerError: '$context.authorizer.error',
      }),
    };

    const authorizer = new HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${props.userPool.userPoolId}`,
      { jwtAudience: [props.userPoolClientId] },
    );

    /*
     * The only unauthenticated surface (DECISIONS #36). Kept on its own path
     * prefix so "is this endpoint public?" is answerable from the route table
     * rather than from handler logic, and restricted to the two verbs the
     * public read path actually uses.
     */
    const publicApiRoutes = httpApi.addRoutes({
      path: '/public/{proxy+}',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('PublicApiIntegration', fn),
      // No authorizer: anonymous by design.
    });

    /*
     * Anonymous traffic is the app's main abuse/cost vector, so the public
     * routes get their own, tighter ceiling on top of the default above.
     *
     * Two escape hatches are needed here. `addPropertyOverride` because CDK
     * does not apply its camelCase → PascalCase renaming inside a map of
     * complex types; and an explicit dependency because per-route settings
     * reference routes by key, so the stage update fails with a 404 unless
     * the routes are created first.
     */
    const publicThrottle = { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 10 };
    cfnStage.addPropertyOverride('RouteSettings', {
      'GET /public/{proxy+}': publicThrottle,
      'POST /public/{proxy+}': publicThrottle,
    });
    for (const route of publicApiRoutes) cfnStage.node.addDependency(route);

    httpApi.addRoutes({
      path: '/{proxy+}',
      // Explicit method list (not HttpMethod.ANY) so OPTIONS preflight stays
      // on API Gateway's built-in CORS handling instead of being routed to
      // this JWT-authorized integration, where a preflight (no Authorization
      // header) would get rejected before the browser ever sees CORS headers.
      methods: [
        apigwv2.HttpMethod.GET,
        apigwv2.HttpMethod.POST,
        apigwv2.HttpMethod.PATCH,
        apigwv2.HttpMethod.PUT,
        apigwv2.HttpMethod.DELETE,
      ],
      integration: new HttpLambdaIntegration('ApiIntegration', fn),
      authorizer,
    });

    new CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
  }
}
