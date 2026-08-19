import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/fields';
import { useAuth } from '../mock-auth';

export function VerifyPage() {
  const { t } = useTranslation();
  const { pending, verify } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  if (!pending) return <Navigate to="/register" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      await verify(code);
      navigate('/dashboard');
    } catch {
      setError(t('auth.errors.codeInvalid'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <h1 className="font-serif text-3xl text-text">{t('auth.verify.title')}</h1>
      <p className="text-sm text-text-secondary">
        {t('auth.verify.description', { email: pending.email })}
      </p>
      <TextField
        id="verify-code"
        label={t('auth.verify.code')}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        error={error}
        className="font-mono tracking-widest"
      />
      <Button type="submit" disabled={submitting}>
        {submitting ? t('common.loading') : t('auth.verify.submit')}
      </Button>
      <p className="text-xs text-text-muted">{t('auth.verify.mockHint')}</p>
    </form>
  );
}
