import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { TextField } from '../../components/ui/fields';
import { authErrorKey } from '../../lib/auth-errors';
import { useAuth } from './auth-provider';

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * In-session password change: requires the current password (Cognito's
 * `updatePassword`), unlike the forgot-password flow which proves identity
 * with an emailed code instead. Reachable from the user menu (AppLayout).
 */
export function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const { t } = useTranslation();
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setErrors({});
    setDone(false);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!current) nextErrors.current = t('auth.errors.invalidCredentials');
    if (next.length < 8) nextErrors.next = t('auth.errors.passwordMin');
    if (confirm !== next) nextErrors.confirm = t('auth.errors.passwordMismatch');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (err) {
      // A wrong current password surfaces the same Cognito exception as a bad
      // sign-in credential — reworded here so it fits this form's context.
      const key =
        err instanceof Error && err.name === 'NotAuthorizedException'
          ? 'auth.errors.incorrectCurrentPassword'
          : authErrorKey(err);
      setErrors({ form: t(key) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t('auth.changePassword.title')}
    >
      {done ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text">{t('auth.changePassword.success')}</p>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                reset();
                onClose();
              }}
            >
              {t('common.close')}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <TextField
            id="change-password-current"
            label={t('auth.changePassword.current')}
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            error={errors.current}
          />
          <TextField
            id="change-password-new"
            label={t('auth.changePassword.new')}
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            error={errors.next}
          />
          <TextField
            id="change-password-confirm"
            label={t('auth.changePassword.confirm')}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm}
          />
          {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
          <div className="mt-1 flex justify-end gap-3">
            <Button variant="tertiary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('common.loading') : t('auth.changePassword.submit')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
