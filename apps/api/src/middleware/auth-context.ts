import type { Context } from 'hono';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { HttpError } from '../http-error';

/**
 * Identity always comes from the API Gateway JWT authorizer's decoded claims
 * (SECURITY.md) — request bodies never carry the caller's userId. The
 * frontend sends the Cognito ID token (not the access token) because it
 * carries the `name` / `custom:username` claims profile creation needs.
 */
function claims(c: Context): Record<string, unknown> {
  const event = (c.env as { event: APIGatewayProxyEventV2WithJWTAuthorizer }).event;
  const claims = event.requestContext.authorizer?.jwt?.claims;
  if (!claims) throw new HttpError(401, 'UNAUTHENTICATED', 'Missing authorizer claims');
  return claims;
}

export function getUserId(c: Context): string {
  const sub = claims(c).sub;
  if (typeof sub !== 'string') throw new HttpError(401, 'UNAUTHENTICATED', 'Missing subject claim');
  return sub;
}

export function getStringClaim(c: Context, name: string): string | undefined {
  const value = claims(c)[name];
  return typeof value === 'string' ? value : undefined;
}
