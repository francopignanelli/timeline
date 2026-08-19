import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/fields';
import { useAuth } from '../mock-auth';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email)) next.email = t('auth.errors.invalidEmail');
    if (password.length < 8) next.password = t('auth.errors.passwordMin');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      setErrors({ form: t('common.errorGeneric') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <h1 className="font-serif text-3xl text-text">{t('auth.login.title')}</h1>
      <TextField
        id="login-email"
        label={t('auth.login.email')}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <TextField
        id="login-password"
        label={t('auth.login.password')}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />
      {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? t('common.loading') : t('auth.login.submit')}
      </Button>
      <div className="flex flex-col gap-2 text-sm text-text-muted">
        <p>
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" className="text-accent hover:text-accent-hover">
            {t('auth.login.registerLink')}
          </Link>
        </p>
        <Link to="/forgot-password" className="text-text-secondary hover:text-text">
          {t('auth.login.forgotLink')}
        </Link>
      </div>
    </form>
  );
}
