import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'tertiary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent text-text-on-dark hover:bg-accent-hover',
  secondary: 'border border-border bg-surface-elevated text-text hover:bg-surface',
  tertiary: 'text-text-secondary hover:text-text',
};

export function Button({ variant = 'primary', className, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${variantClasses[variant]} ${className ?? ''}`}
      {...rest}
    />
  );
}
