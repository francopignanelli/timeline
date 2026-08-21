import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { TimelineMotif } from '../../components/brand/TimelineMotif';

interface WelcomeTutorialProps {
  open: boolean;
  onClose: () => void;
}

type StepKey = 'timeline' | 'milestone' | 'stage';
const STEP_KEYS: StepKey[] = ['timeline', 'milestone', 'stage'];

/** A single rotated diamond, matching MilestoneLayer's actual marker exactly (shine included) — the tutorial shows the same shape the canvas does, not a stand-in icon. */
function MilestoneVisual() {
  return (
    <div className="flex h-16 items-center justify-center">
      <span className="relative flex size-6 items-center justify-center">
        <span className="size-4 rotate-45 rounded-[3px] bg-accent shadow-[0_1px_2px_rgba(20,20,19,0.18)]">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-[3px] bg-gradient-to-br from-white/55 via-white/10 to-transparent"
          />
        </span>
      </span>
    </div>
  );
}

/** A tinted rounded band, matching StageLayer's actual rendering (accent stroke, low-opacity fill). */
function StageVisual() {
  return (
    <div className="flex h-16 items-center justify-center">
      <div className="h-7 w-44 rounded-md border border-accent bg-accent/10" />
    </div>
  );
}

function TimelineVisual() {
  return (
    <div className="flex h-16 items-center justify-center">
      <TimelineMotif width={220} />
    </div>
  );
}

const VISUALS: Record<StepKey, () => React.ReactNode> = {
  timeline: TimelineVisual,
  milestone: MilestoneVisual,
  stage: StageVisual,
};

/**
 * Three steps, one per core concept, each with the same shape the canvas
 * itself uses (not a separate icon set) — so the tutorial doubles as a
 * preview of what the user is about to look at, rather than an abstract
 * explanation disconnected from the actual UI.
 */
export function WelcomeTutorial({ open, onClose }: WelcomeTutorialProps) {
  const { t } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);

  const finish = () => {
    setStepIndex(0);
    onClose();
  };

  const stepKey = STEP_KEYS[stepIndex]!;
  const Visual = VISUALS[stepKey];
  const isLast = stepIndex === STEP_KEYS.length - 1;

  return (
    <Dialog open={open} onClose={finish} title={t(`tutorial.steps.${stepKey}.title`)}>
      <div className="flex flex-col gap-5">
        <p className="font-mono text-xs text-text-muted">
          {t('tutorial.stepLabel', { current: stepIndex + 1, total: STEP_KEYS.length })}
        </p>

        <Visual />

        <p className="text-center text-sm text-text-secondary">
          {t(`tutorial.steps.${stepKey}.body`)}
        </p>
        <p className="text-center font-serif text-lg text-text">
          {t(`tutorial.steps.${stepKey}.example`)}
        </p>

        {/* A simple dot trail, not a progress bar — enough to show where you
            are in three steps without competing with the content above. */}
        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {STEP_KEYS.map((key, i) => (
            <span
              key={key}
              className={`size-1.5 rounded-full ${i === stepIndex ? 'bg-accent' : 'bg-border'}`}
            />
          ))}
        </div>

        <div className="mt-1 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-sm text-text-muted underline-offset-4 hover:text-text hover:underline"
          >
            {t('tutorial.skip')}
          </button>
          <div className="flex gap-3">
            <Button
              variant="tertiary"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            >
              {t('tutorial.back')}
            </Button>
            <Button onClick={() => (isLast ? finish() : setStepIndex((i) => i + 1))}>
              {isLast ? t('tutorial.finish') : t('tutorial.next')}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
