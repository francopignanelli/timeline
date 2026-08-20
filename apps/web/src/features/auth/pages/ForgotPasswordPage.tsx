import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/fields';
import { authErrorKey } from '../../../lib/auth-errors';
import { useAuth } from '../auth-provider';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { requestPasswordReset, confirmPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [errors, setErrors] = useState<{
    email?: string;
    code?: string;
    newPassword?: string;
    form?: string;
  }>({});
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      setErrors({ email: t('auth.errors.invalidEmail') });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setErrors({ form: t(authErrorKey(err)) });
    } finally {
      setSubmitting(false);
    }
  };

  const onConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\d{6}$/.test(code)) next.code = t('auth.errors.codeInvalid');
    if (newPassword.length < 8) next.newPassword = t('auth.errors.passwordMin');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    try {
      await confirmPasswordReset(email, code, newPassword);
      navigate('/login');
    } catch (err) {
      setErrors({ form: t(authErrorKey(err)) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={sent ? onConfirmSubmit : onRequestSubmit}
      className="flex flex-col gap-5"
      noValidate
    >
      <h1 className="font-serif text-3xl text-text">{t('auth.forgot.title')}</h1>
      {sent ? (
        <>
          <p className="text-sm text-text-secondary">{t('auth.forgot.sent', { email })}</p>
          <TextField
            id="forgot-code"
            label={t('auth.forgot.code')}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            error={errors.code}
            className="font-mono tracking-widest"
          />
          <TextField
            id="forgot-new-password"
            label={t('auth.forgot.newPassword')}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={errors.newPassword}
          />
          {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? t('common.loading') : t('auth.forgot.confirmSubmit')}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-text-secondary">{t('auth.forgot.description')}</p>
          <TextField
            id="forgot-email"
            label={t('auth.forgot.email')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? t('common.loading') : t('auth.forgot.submit')}
          </Button>
        </>
      )}
      <Link to="/login" className="text-sm text-text-secondary hover:text-text">
        {t('auth.forgot.backToLogin')}
      </Link>
    </form>
  );
}
