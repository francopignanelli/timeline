import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Visibility } from '@timeline/shared';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { publicUrlFor } from '../../lib/sharing-api';
import { CollaboratorsPanel } from './CollaboratorsPanel';
import { useRotateShareToken, useSetVisibility, useShareSettings } from './hooks';

interface ShareDialogProps {
  timelineId: string;
  open: boolean;
  onClose: () => void;
}

const SETTABLE: Exclude<Visibility, 'SHARED'>[] = ['PRIVATE', 'UNLISTED', 'PUBLIC'];

export function ShareDialog({ timelineId, open, onClose }: ShareDialogProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'people' | 'link'>('people');
  const [copied, setCopied] = useState(false);

  const share = useShareSettings(timelineId, open);
  const setVisibility = useSetVisibility(timelineId);
  const rotate = useRotateShareToken(timelineId);

  const visibility = share.data?.visibility ?? 'PRIVATE';
  const shareToken = share.data?.shareToken;
  const link = shareToken ? publicUrlFor(shareToken) : null;

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('share.title')}>
      <div className="mb-4 flex gap-2 border-b border-border">
        {(['people', 'link'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === id ? 'border-accent text-text' : 'border-transparent text-text-muted'
            }`}
          >
            {t(`share.tab.${id}`)}
          </button>
        ))}
      </div>

      {tab === 'people' ? (
        <CollaboratorsPanel scope="TIMELINE" resourceId={timelineId} canManage />
      ) : (
        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-text-secondary">
              {t('share.visibility')}
            </legend>
            {SETTABLE.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-surface"
              >
                <input
                  type="radio"
                  name="visibility"
                  className="mt-1 accent-accent"
                  checked={visibility === option}
                  disabled={setVisibility.isPending}
                  onChange={() => void setVisibility.mutateAsync(option)}
                />
                <span className="flex flex-col">
                  <span className="text-sm text-text">{t(`share.visibilities.${option}.label`)}</span>
                  <span className="text-xs text-text-muted">
                    {t(`share.visibilities.${option}.hint`)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          {link ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-text-secondary">{t('share.linkLabel')}</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  readOnly
                  value={link}
                  aria-label={t('share.linkLabel')}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 font-mono text-xs text-text-secondary"
                />
                <Button variant="secondary" onClick={() => void copy()}>
                  {copied ? t('share.copied') : t('share.copy')}
                </Button>
              </div>
              <button
                type="button"
                onClick={() => void rotate.mutateAsync()}
                disabled={rotate.isPending}
                className="self-start text-xs text-text-muted hover:text-danger"
              >
                {t('share.revoke')}
              </button>
              <p className="text-xs text-text-muted">{t('share.revokeHint')}</p>
            </div>
          ) : (
            <p className="text-sm text-text-muted">{t('share.privateHint')}</p>
          )}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button variant="tertiary" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </Dialog>
  );
}
