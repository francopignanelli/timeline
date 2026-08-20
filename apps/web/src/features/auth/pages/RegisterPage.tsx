import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LIMITS, usernameSchema } from '@timeline/shared';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/fields';
import { authErrorKey } from '../../../lib/auth-errors';
import { useAuth } from '../auth-provider';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Strips anything outside `usernameSchema`'s charset live, so what you type stays valid as you type. */
function sanitizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, LIMITS.USERNAME_MAX);
}

export function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<
    Partial<Record<'email' | 'username' | 'displayName' | 'password' | 'form', string>>
  >({});
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email)) next.email = t('auth.errors.invalidEmail');
    // Input is already sanitized to the allowed charset as the user types
    // (see onChange below), so the only way validation still fails here is
    // length — the specific message tells them which.
    if (!usernameSchema.safeParse(username).success) {
      next.username =
        username.length < LIMITS.USERNAME_MIN
          ? t('auth.errors.usernameTooShort', { min: LIMITS.USERNAME_MIN })
          : t('auth.errors.usernameInvalid');
    }
    if (displayName.trim().length === 0) next.displayName = t('auth.errors.displayNameRequired');
    if (password.length < 8) next.password = t('auth.errors.passwordMin');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    try {
      await register({ email, username, displayName: displayName.trim(), password });
      navigate('/verify');
    } catch (err) {
      setErrors({ form: t(authErrorKey(err)) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <h1 className="font-serif text-3xl text-text">{t('auth.register.title')}</h1>
      <TextField
        id="register-email"
        label={t('auth.register.email')}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <TextField
        id="register-username"
        label={t('auth.register.username')}
        autoComplete="username"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={username}
        onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
        error={errors.username}
        hint={t('auth.register.usernameHint', { max: LIMITS.USERNAME_MAX })}
      />
      <TextField
        id="register-display-name"
        label={t('auth.register.displayName')}
        autoComplete="name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        error={errors.displayName}
      />
      <TextField
        id="register-password"
        label={t('auth.register.password')}
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />
      {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? t('common.loading') : t('auth.register.submit')}
      </Button>
      <p className="text-sm text-text-muted">
        {t('auth.register.haveAccount')}{' '}
        <Link to="/login" className="text-accent hover:text-accent-hover">
          {t('auth.register.loginLink')}
        </Link>
      </p>
    </form>
  );
}
