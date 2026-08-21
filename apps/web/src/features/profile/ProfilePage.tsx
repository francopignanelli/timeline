import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Locale } from '@timeline/shared';
import { LIMITS, LOCALES, updateProfileSchema } from '@timeline/shared';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { SelectField, TextField, TextareaField } from '../../components/ui/fields';
import { acceptFor, isImageMime, maxBytesFor, uploadFile } from '../../lib/uploads-api';
import i18n from '../../lib/i18n';
import { useAuth } from '../auth/auth-provider';
import { useProfile, useUpdateProfile } from './hooks';
import { useAvatarUrl } from './useAvatarUrl';

type FieldErrors = Partial<Record<'displayName' | 'website' | 'form', string>>;

export function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const update = useUpdateProfile();
  const { data: avatarUrl } = useAvatarUrl(profile?.avatarKey);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string>();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [locale, setLocale] = useState<Locale>('en');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setBio(profile.bio ?? '');
      setLocation(profile.location ?? '');
      setWebsite(profile.website ?? '');
      setLocale(profile.locale);
    }
  }, [profile]);

  /**
   * Avatar changes save immediately rather than waiting for the form's Save —
   * the file is already in S3 by then, so leaving the record unset would strand
   * an orphaned object.
   */
  const onPickAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!isImageMime(file.type)) {
      setAvatarError(t('milestone.errors.uploadType'));
      return;
    }
    if (file.size > maxBytesFor('IMAGE')) {
      setAvatarError(
        t('milestone.errors.uploadTooLarge', {
          max: Math.round(LIMITS.IMAGE_MAX_BYTES / (1024 * 1024)),
        }),
      );
      return;
    }
    setAvatarError(undefined);
    setUploadingAvatar(true);
    try {
      const contentType = file.type;
      const avatarKey = await uploadFile(
        { kind: 'IMAGE', fileName: file.name, contentType, size: file.size },
        file,
      );
      await update.mutateAsync({
        displayName: displayName.trim() || profile?.displayName || '',
        bio: bio.trim(),
        location: location.trim(),
        website: website.trim(),
        locale,
        avatarKey,
      });
    } catch {
      setAvatarError(t('milestone.errors.uploadFailed'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onRemoveAvatar = async () => {
    setAvatarError(undefined);
    setUploadingAvatar(true);
    try {
      // Empty string clears it; omitting the key would just leave it unchanged.
      await update.mutateAsync({
        displayName: displayName.trim() || profile?.displayName || '',
        bio: bio.trim(),
        location: location.trim(),
        website: website.trim(),
        locale,
        avatarKey: '',
      });
    } catch {
      setAvatarError(t('common.errorGeneric'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const parsed = updateProfileSchema.safeParse({
      displayName: displayName.trim(),
      bio: bio.trim(),
      location: location.trim(),
      website: website.trim(),
      locale,
    });

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'displayName') next.displayName = t('profile.errors.displayNameRequired');
        else if (issue.path[0] === 'website') next.website = t('profile.errors.websiteInvalid');
        else next.form = t('common.errorGeneric');
      }
      setErrors(next);
      return;
    }

    setErrors({});
    try {
      await update.mutateAsync(parsed.data);
      // The profile owns the language preference, so persist it to the UI too.
      if (i18n.language !== locale) void i18n.changeLanguage(locale);
      setSaved(true);
    } catch {
      setErrors({ form: t('common.errorGeneric') });
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12 md:py-16">
      <Link to="/dashboard" className="text-sm text-text-secondary hover:text-text">
        ← {t('timeline.backToDashboard')}
      </Link>

      <h1 className="mt-6 font-serif text-4xl text-text">{t('profile.title')}</h1>

      {isLoading && (
        <div className="mt-10 flex flex-col gap-5" aria-label={t('common.loading')}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      )}

      {isError && (
        <div className="mt-10 flex flex-col items-start gap-3">
          <p className="text-sm text-danger">{t('common.errorGeneric')}</p>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {profile && (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Avatar displayName={displayName || profile.displayName} url={avatarUrl} size="lg" />

            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-mono text-sm text-text-muted">@{profile.username}</span>
              <span className="text-xs text-text-muted">{t('profile.usernameImmutable')}</span>

              <span className="mt-1 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="text-sm text-accent underline-offset-4 hover:underline disabled:opacity-50"
                >
                  {uploadingAvatar ? t('profile.avatar.uploading') : t('profile.avatar.change')}
                </button>
                {profile.avatarKey && (
                  <button
                    type="button"
                    disabled={uploadingAvatar}
                    onClick={() => void onRemoveAvatar()}
                    className="text-sm text-text-muted hover:text-danger"
                  >
                    {t('profile.avatar.remove')}
                  </button>
                )}
              </span>
              {avatarError && <p className="text-sm text-danger">{avatarError}</p>}
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept={acceptFor('IMAGE')}
              className="hidden"
              onChange={(e) => {
                void onPickAvatar(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>

          {/*
            Email is read from the Cognito ID token, not stored on the profile
            record — one source of truth, and no second copy of a personal
            identifier in our own table. Read-only: changing it would need
            Cognito's verification flow.
          */}
          <div className="mt-6 flex flex-col gap-1 rounded-lg border border-border bg-surface px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {t('profile.email')}
            </span>
            <span className="text-sm text-text">{user?.email ?? '—'}</span>
            <span className="text-xs text-text-muted">{t('profile.emailImmutable')}</span>
          </div>

          <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-5" noValidate>
            <TextField
              id="profile-display-name"
              label={t('profile.displayName')}
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              error={errors.displayName}
            />
            <TextareaField
              id="profile-bio"
              label={t('profile.bio')}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <TextField
              id="profile-location"
              label={t('profile.location')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <TextField
              id="profile-website"
              label={t('profile.website')}
              inputMode="url"
              placeholder="https://"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              error={errors.website}
            />
            <SelectField
              id="profile-locale"
              label={t('common.language')}
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
            >
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {t(`profile.locales.${l}`)}
                </option>
              ))}
            </SelectField>

            {errors.form && <p className="text-sm text-danger">{errors.form}</p>}

            <div className="mt-1 flex items-center justify-end gap-4">
              <p aria-live="polite" className="text-sm text-text-muted">
                {saved ? t('profile.saved') : ''}
              </p>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? t('common.loading') : t('common.save')}
              </Button>
            </div>
          </form>
          <div className="mt-8 border-t border-border pt-5">
            <Link to="/terms" className="text-sm text-text-secondary underline-offset-4 hover:text-text hover:underline">
              {t('legal.termsLink')}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
