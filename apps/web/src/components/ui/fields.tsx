import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export const inputClasses =
  'h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text placeholder:text-text-muted';

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function FieldShell({ id, label, error, hint, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text-secondary">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ id, label, error, hint, className, ...rest }: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClasses} ${className ?? ''}`}
        {...rest}
      />
    </FieldShell>
  );
}

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  error?: string;
}

export function TextareaField({ id, label, error, className, ...rest }: TextareaFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error}>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-text-muted ${className ?? ''}`}
        {...rest}
      />
    </FieldShell>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label: string;
  error?: string;
}

export function SelectField({ id, label, error, className, children, ...rest }: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error}>
      <select id={id} className={`${inputClasses} ${className ?? ''}`} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
}

interface CheckboxFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
}

export function CheckboxField({ id, label, className, ...rest }: CheckboxFieldProps) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-text">
      <input
        id={id}
        type="checkbox"
        className={`size-4 accent-accent ${className ?? ''}`}
        {...rest}
      />
      {label}
    </label>
  );
}
