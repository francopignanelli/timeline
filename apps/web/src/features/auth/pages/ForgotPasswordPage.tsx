import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/fields';
import { useAuth } from '../mock-auth';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      setError(t('auth.errors.invalidEmail'));
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <h1 className="font-serif text-3xl text-text">{t('auth.forgot.title')}</h1>
      {sent ? (
        <p className="text-sm text-text-secondary">{t('auth.forgot.sent', { email })}</p>
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
            error={error}
          />
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
