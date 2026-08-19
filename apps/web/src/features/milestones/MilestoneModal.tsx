import { useTranslation } from 'react-i18next';
import type { Milestone } from '@timeline/shared';
import { Dialog } from '../../components/ui/Dialog';
import { formatPartialDate } from '../../lib/format-date';
import { useMilestoneReferenceCount } from '../timelines/hooks';

interface MilestoneModalProps {
  milestone: Milestone | null;
  onClose: () => void;
}

/** Read-only milestone detail view (URL-driven). Editing arrives in Phase 6. */
export function MilestoneModal({ milestone, onClose }: MilestoneModalProps) {
  const { t, i18n } = useTranslation();
  const { data: referenceCount } = useMilestoneReferenceCount(milestone ? milestone.id : null);

  return (
    <Dialog open={milestone !== null} onClose={onClose} title={milestone?.title ?? ''}>
      {milestone && (
        <div className="flex flex-col gap-4">
          <p className="font-mono text-sm uppercase tracking-wide text-text-muted">
            {formatPartialDate(milestone.date, i18n.language)}
          </p>
          {[...milestone.blocks]
            .sort((a, b) => a.order - b.order)
            .map((block) => (
              <p key={block.id} className="whitespace-pre-wrap text-base text-text-secondary">
                {block.text}
              </p>
            ))}
          {referenceCount !== undefined && (
            <p className="mt-2 border-t border-border pt-3 text-xs text-text-muted">
              {t('milestone.appearsIn', { count: referenceCount })}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
