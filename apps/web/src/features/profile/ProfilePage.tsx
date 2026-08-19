import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Locale } from '@timeline/shared';
import { LOCALES, updateProfileSchema } from '@timeline/shared';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField, TextareaField } from '../../components/ui/fields';
import { initials } from '../../lib/initials';
import i18n from '../../lib/i18n';
import { useProfile, useUpdateProfile } from './hooks';

type FieldErrors = Partial<Record<'displayName' | 'website' | 'form', string>>;

export function ProfilePage() {
  const { t } = useTranslation();
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const update = useUpdateProfile();

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
          <div className="mt-8 flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex size-16 items-center justify-center rounded-full border border-border bg-surface text-xl font-medium text-text-secondary"
            >
              {initials(displayName || profile.displayName)}
            </span>
            <div className="flex flex-col">
              <span className="font-mono text-sm text-text-muted">@{profile.username}</span>
              <span className="text-xs text-text-muted">{t('profile.usernameImmutable')}</span>
            </div>
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
        </>
      )}
    </div>
  );
}
