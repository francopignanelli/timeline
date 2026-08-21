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
import { Button } from '../../components/ui/Button';

interface TimelineCanvasProps {
  timeline: Timeline;
  content: CanvasContent;
  selectedMilestoneId: string | null;
  selectedStageId?: string | null;
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
  selectedStageId = null,
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
        measureTextWidth(m.label, MILESTONE_LABEL_FONT) * MEASURE_SAFETY + 4,
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

  // "100%" is defined as the fit-to-view scale, not some absolute px/day
  // baseline — there's no natural "actual size" for a day-based canvas, and
  // tying it to Fit (right next to the readout) makes the number mean
  // something a viewer can act on: back to 100 is back to the whole range.
  const fitScale = useMemo(
    () => (width > 0 ? fitRange(items.fitStart, items.fitEnd, width) : null),
    [width, items.fitStart, items.fitEnd],
  );
  const zoomPercent =
    scale && fitScale ? Math.round((scale.pxPerDay / fitScale.pxPerDay) * 100) : 100;

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
    // [data-canvas-hit] covers the milestone connector's invisible hit-slop:
    // a decorative (role="presentation") click target, so it needs its own
    // marker to be excluded from drag-start the same way real buttons are.
    if ((e.target as Element).closest('button, [role="button"], [data-canvas-hit]')) return;
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
    // The Add Milestone/Add Stage dialogs render inside this same container,
    // so typing in one of their fields bubbles a keydown up to here. Without
    // this guard, "0" (fit), "+"/"-" (zoom) and the arrow keys (pan) hijack
    // ordinary typing and text-cursor movement — "0" in particular calls
    // preventDefault(), which silently blocks the character from ever
    // reaching the input (reported: can't type a 0 in milestone/stage forms).
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, dialog')) return;
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
              selectedId={selectedStageId}
              onOpen={onOpenStage}
            />
            <TimeAxisLayer
              scale={scale}
              width={width}
              axisY={axisY}
              rulerVisible={rulerVisible}
              today={today}
              rangeStartDay={items.boundStart}
              ongoing={timeline.ongoing}
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

      <div className="absolute right-4 top-4 flex items-center gap-2">
        {!readOnly && (
          <>
            {/* + Milestone is the primary action here — creating content is
                what most toolbar visits are for; + Stage is the secondary,
                less frequent counterpart. */}
            <Button className="h-9 px-3 text-sm" onClick={() => setAddMilestoneOpen(true)}>
              {t('canvas.addMilestone.short')}
            </Button>
            <Button
              variant="secondary"
              className="h-9 px-3 text-sm"
              onClick={() => setAddStageOpen(true)}
            >
              {t('canvas.addStage.short')}
            </Button>
            <div aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
          </>
        )}

        {/* Zoom out / current level / zoom in / fit read as one connected
            control, not four separate buttons — the percentage is what ties
            them together (100% is defined as the Fit scale, right next to it). */}
        <div className="flex h-9 items-center overflow-hidden rounded-lg border border-border bg-surface-elevated">
          <CanvasGroupButton
            label={t('canvas.zoomOut')}
            onClick={() => scale && setScale(zoomAt(scale, width / 2, 1 / BUTTON_ZOOM_FACTOR))}
          >
            −
          </CanvasGroupButton>
          <span className="min-w-10 select-none text-center font-mono text-xs tabular-nums text-text-muted">
            {zoomPercent}%
          </span>
          <CanvasGroupButton
            label={t('canvas.zoomIn')}
            onClick={() => scale && setScale(zoomAt(scale, width / 2, BUTTON_ZOOM_FACTOR))}
          >
            +
          </CanvasGroupButton>
          <div aria-hidden="true" className="h-5 w-px bg-border" />
          <CanvasGroupButton label={t('canvas.fit')} onClick={fit} wide>
            {t('canvas.fit')}
          </CanvasGroupButton>
        </div>

        <div aria-hidden="true" className="mx-1 h-6 w-px bg-border" />

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

/** Borderless variant for a button living inside the connected zoom pill — the pill supplies the border, not each button. */
function CanvasGroupButton({
  label,
  onClick,
  wide,
  children,
}: {
  label: string;
  onClick: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`h-9 ${wide ? 'px-3' : 'w-9'} text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text`}
    >
      {children}
    </button>
  );
}
