import { useTranslation } from 'react-i18next';
import type { EntityColor } from '@timeline/shared';
import { ENTITY_COLORS } from '@timeline/shared';
import { entityColorVar } from '../../lib/entity-color';

interface ColorPickerProps {
  label: string;
  value: EntityColor;
  onChange: (color: EntityColor) => void;
}

/**
 * Named-palette picker (never a free-form hex input): stored data may only
 * reference a design token, so the swatches *are* the allowed values.
 */
export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {ENTITY_COLORS.map((color) => {
          const resolved = entityColorVar(color);
          const selected = value === color;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t(`colors.${color}`)}
              title={t(`colors.${color}`)}
              onClick={() => onChange(color)}
              className={`flex size-8 items-center justify-center rounded-full border transition-colors ${
                selected ? 'border-text' : 'border-border hover:border-text-muted'
              }`}
            >
              <span
                className={`relative size-4 rotate-45 rounded-[2px] ${resolved ? '' : 'bg-text-muted'}`}
                style={resolved ? { backgroundColor: resolved } : undefined}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-[2px] bg-gradient-to-br from-white/55 via-white/10 to-transparent"
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
