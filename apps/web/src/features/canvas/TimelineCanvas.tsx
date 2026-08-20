import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Timeline } from '@timeline/shared';
import type { CanvasContent } from './canvas-items';
import { useElementSize } from '../../hooks/useElementSize';
import { measureTextWidth } from '../../lib/measure-text';
import { buildCanvasItems } from './canvas-items';
import { todayDayNumber } from './domain/day-number';
import { assignLanes, laneCount } from './domain/lane-layout';
import { assignMilestoneLevels, type PlacedMilestone } from './domain/collision-layout';
import { computeVerticalLayout } from './domain/vertical-layout';
import { MILESTONE_LABEL_MAX_PX } from './MilestoneLayer';
import type { TimeScale } from './domain/time-scale';
import { fitRange, panByPx, visibleRange, zoomAt } from './domain/time-scale';
import { TimeAxisLayer } from './TimeAxisLayer';
import { StageLayer } from './StageLayer';
import { MilestoneLayer } from './MilestoneLayer';
import { AddMilestoneDialog } from './AddMilestoneDialog';
import { AddStageDialog } from './AddStageDialog';

interface TimelineCanvasProps {
  timeline: Timeline;
  content: CanvasContent;
  selectedMilestoneId: string | null;
  onOpenMilestone: (milestoneId: string) => void;
  onOpenStage: (stageId: string) => void;
  /** Public/visitor mode: pan and zoom stay, every mutation affordance goes. */
  readOnly?: boolean;
  /** Set on the public route so media resolves through the anonymous endpoint. */
  publicShareToken?: string;
}

const KEY_PAN_PX = 120;
const BUTTON_ZOOM_FACTOR = 1.4;
const CULL_MARGIN_PX = 240;

// Must match the milestone label's rendered font (text-sm + --font-sans).
const MILESTONE_LABEL_FONT = '14px "Inter Variable", ui-sans-serif, system-ui, sans-serif';
// Footprint geometry around the dot: button padding + dot + gaps + label padding.
const FOOTPRINT_LEFT_PX = -16;
const FOOTPRINT_BASE_RIGHT_PX = 34;
// Safety factor: measurements may briefly use fallback-font metrics.
const MEASURE_SAFETY = 1.08;

export function TimelineCanvas({
  timeline,
  content,
  selectedMilestoneId,
  onOpenMilestone,
  onOpenStage,
  readOnly = false,
}: TimelineCanvasProps) {
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(containerRef);
  const [scale, setScale] = useState<TimeScale | null>(null);
  const [rulerVisible, setRulerVisible] = useState(timeline.rulerVisible);
  const [dragging, setDragging] = useState(false);
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [addStageOpen, setAddStageOpen] = useState(false);
  const dragState = useRef<{ pointerId: number; lastX: number } | null>(null);

  const today = useMemo(() => todayDayNumber(), []);
  const items = useMemo(
    () => buildCanvasItems(timeline, content, today, i18n.language, t('common.present')),
    [timeline, content, today, i18n.language, t],
  );

  const lanes = useMemo(() => assignLanes(items.stages), [items.stages]);
  const stageLaneCount = useMemo(() => laneCount(lanes), [lanes]);
  const layout = useMemo(
    () => computeVerticalLayout(height, stageLaneCount),
    [height, stageLaneCount],
  );

  const [fontsLoaded, setFontsLoaded] = useState(false);
  useEffect(() => {
    let mounted = true;
    void document.fonts?.ready.then(() => {
      if (mounted) setFontsLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const labelExtents = useMemo(() => {
    void fontsLoaded; // re-measure once real font metrics are available
    return items.milestones.map((m) => {
      const labelWidth = Math.min(
        MILESTONE_LABEL_MAX_PX,
        measureTextWidth(m.title, MILESTONE_LABEL_FONT) * MEASURE_SAFETY + 4,
      );
      return {
        id: m.id,
        day: m.day,
        startOffsetPx: FOOTPRINT_LEFT_PX,
        endOffsetPx: FOOTPRINT_BASE_RIGHT_PX + labelWidth,
      };
    });
  }, [items.milestones, fontsLoaded]);

  const levels = useMemo(
    () =>
      scale
        ? assignMilestoneLevels(labelExtents, scale.pxPerDay, { maxLevels: layout.maxLevels })
        : new Map<string, PlacedMilestone>(),
    [labelExtents, scale, layout.maxLevels],
  );

  const fit = useCallback(() => {
    if (width > 0) setScale(fitRange(items.fitStart, items.fitEnd, width));
  }, [width, items.fitStart, items.fitEnd]);

  useEffect(() => {
    if (!scale && width > 0) fit();
  }, [scale, width, fit]);

  // Wheel: plain = pan, ctrl/cmd = zoom anchored at the cursor. Must be a
  // non-passive listener to preventDefault browser zoom/scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => {
        if (!s) return s;
        if (e.ctrlKey || e.metaKey) {
          const rect = el.getBoundingClientRect();
          return zoomAt(s, e.clientX - rect.left, Math.exp(-e.deltaY * 0.0018));
        }
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        return panByPx(s, -delta);
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as Element).closest('button, [role="button"]')) return;
    containerRef.current?.setPointerCapture(e.pointerId);
    dragState.current = { pointerId: e.pointerId, lastX: e.clientX };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.lastX;
    drag.lastX = e.clientX;
    setScale((s) => (s ? panByPx(s, dx) : s));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.current?.pointerId === e.pointerId) {
      dragState.current = null;
      setDragging(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!scale) return;
    const zoomCenter = width / 2;
    if (e.key === 'ArrowRight') setScale(panByPx(scale, -KEY_PAN_PX));
    else if (e.key === 'ArrowLeft') setScale(panByPx(scale, KEY_PAN_PX));
    else if (e.key === '+' || e.key === '=') setScale(zoomAt(scale, zoomCenter, BUTTON_ZOOM_FACTOR));
    else if (e.key === '-') setScale(zoomAt(scale, zoomCenter, 1 / BUTTON_ZOOM_FACTOR));
    else if (e.key === '0') fit();
    else return;
    e.preventDefault();
  };

  const axisY = layout.axisY;
  const isEmpty = items.milestones.length === 0 && items.stages.length === 0;

  const visible = scale ? visibleRange(scale, width) : null;
  const marginDays = scale && visible ? CULL_MARGIN_PX / scale.pxPerDay : 0;
  const visibleMilestones =
    scale && visible
      ? items.milestones.filter(
          (m) => m.day >= visible.startDay - marginDays && m.day <= visible.endDay + marginDays,
        )
      : [];
  const visibleStages =
    scale && visible
      ? items.stages.filter(
          (s) => s.endDay >= visible.startDay - marginDays && s.startDay <= visible.endDay + marginDays,
        )
      : [];

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={t('canvas.label')}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      className={`relative h-full w-full touch-none select-none overflow-hidden bg-bg ${
        dragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {scale && (
        <>
          <svg width={width} height={height} className="absolute inset-0">
            <StageLayer
              scale={scale}
              stages={visibleStages}
              lanes={lanes}
              axisY={axisY}
              onOpen={onOpenStage}
            />
            <TimeAxisLayer
              scale={scale}
              width={width}
              axisY={axisY}
              rulerVisible={rulerVisible}
              today={today}
            />
          </svg>
          <MilestoneLayer
            scale={scale}
            milestones={visibleMilestones}
            placed={levels}
            layout={layout}
            rulerVisible={rulerVisible}
            selectedId={selectedMilestoneId}
            onOpen={onOpenMilestone}
          />
        </>
      )}

      {isEmpty && (
        <p
          className="absolute left-1/2 -translate-x-1/2 font-mono text-sm text-text-muted"
          style={{ top: axisY - 56 }}
        >
          {t('canvas.empty')}
        </p>
      )}

      <div className="absolute right-4 top-4 flex gap-2">
        {!readOnly && (
          <>
            <CanvasButton
              label={t('canvas.addMilestone.title')}
              onClick={() => setAddMilestoneOpen(true)}
            >
              {t('canvas.addMilestone.short')}
            </CanvasButton>
            <CanvasButton label={t('canvas.addStage.title')} onClick={() => setAddStageOpen(true)}>
              {t('canvas.addStage.short')}
            </CanvasButton>
          </>
        )}
        <CanvasButton
          label={t('canvas.zoomOut')}
          onClick={() => scale && setScale(zoomAt(scale, width / 2, 1 / BUTTON_ZOOM_FACTOR))}
        >
          −
        </CanvasButton>
        <CanvasButton
          label={t('canvas.zoomIn')}
          onClick={() => scale && setScale(zoomAt(scale, width / 2, BUTTON_ZOOM_FACTOR))}
        >
          +
        </CanvasButton>
        <CanvasButton label={t('canvas.fit')} onClick={fit}>
          {t('canvas.fit')}
        </CanvasButton>
        <CanvasButton
          label={t('canvas.ruler')}
          pressed={rulerVisible}
          onClick={() => setRulerVisible((v) => !v)}
        >
          {t('canvas.ruler')}
        </CanvasButton>
      </div>

      {!readOnly && (
        <>
          <AddMilestoneDialog
            timelineId={timeline.id}
            open={addMilestoneOpen}
            onClose={() => setAddMilestoneOpen(false)}
          />
          <AddStageDialog
            timelineId={timeline.id}
            open={addStageOpen}
            onClose={() => setAddStageOpen(false)}
          />
        </>
      )}
    </div>
  );
}

interface CanvasButtonProps {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}

function CanvasButton({ label, onClick, pressed, children }: CanvasButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`h-9 min-w-9 rounded-lg border border-border bg-surface-elevated px-2.5 text-sm transition-colors ${
        pressed === false ? 'text-text-muted' : 'text-text-secondary'
      } hover:text-text`}
    >
      {children}
    </button>
  );
}
