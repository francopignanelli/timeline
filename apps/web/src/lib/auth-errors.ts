/**
 * Maps Cognito's exception names (thrown by aws-amplify/auth as `Error.name`)
 * to a translation key, so the UI never shows a raw Cognito error string.
 * Unknown errors fall back to a generic message — never leak internals.
 */
export function authErrorKey(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  switch (name) {
    case 'UsernameExistsException':
      return 'auth.errors.emailTaken';
    case 'InvalidPasswordException':
      return 'auth.errors.passwordWeak';
    case 'CodeMismatchException':
      return 'auth.errors.codeInvalid';
    case 'ExpiredCodeException':
      return 'auth.errors.codeExpired';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
    case 'TooManyFailedAttemptsException':
      return 'auth.errors.tooManyAttempts';
    case 'NotAuthorizedException':
      return 'auth.errors.invalidCredentials';
    case 'UserNotConfirmedException':
      return 'auth.errors.notConfirmed';
    case 'UserNotFoundException':
      // Cognito's own preventUserExistenceErrors usually hides this as
      // NotAuthorizedException instead, but handle it defensively.
      return 'auth.errors.invalidCredentials';
    default:
      return 'common.errorGeneric';
  }
}
