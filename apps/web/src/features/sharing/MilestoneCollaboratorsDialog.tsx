import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { CollaboratorsPanel } from './CollaboratorsPanel';

interface MilestoneCollaboratorsDialogProps {
  milestoneId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Collaborator management, split out of the edit form: inviting someone is
 * its own action with its own button (Invite), not part of the pending edit
 * Save/Cancel represents — keeping it inline left two unrelated action pairs
 * stacked in one form. Mirrors `ShareDialog`, which already does the same
 * thing at the Timeline level (DECISIONS #54).
 */
export function MilestoneCollaboratorsDialog({
  milestoneId,
  open,
  onClose,
}: MilestoneCollaboratorsDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} title={t('collab.milestoneSection')}>
      <CollaboratorsPanel scope="MILESTONE" resourceId={milestoneId} canManage />
      <div className="mt-6 flex justify-end">
        <Button variant="tertiary" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </Dialog>
  );
}
