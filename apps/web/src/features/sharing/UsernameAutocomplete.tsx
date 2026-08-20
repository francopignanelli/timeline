import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LIMITS } from '@timeline/shared';
import { searchUsers } from '../../lib/members-api';
import { FieldShell, inputClasses } from '../../components/ui/fields';

interface UsernameAutocompleteProps {
  id: string;
  label: string;
  value: string;
  onChange: (username: string) => void;
  /** Enter submits. There is no surrounding <form> to do it — see CollaboratorsPanel. */
  onSubmit?: () => void;
  error?: string;
}

/** Mirrors `usernameSchema`'s charset so an existing user can always be typed. */
function sanitize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, LIMITS.USERNAME_MAX);
}

/**
 * Suggests only **registered** users, so an invite can't be addressed to a
 * handle that doesn't exist. Backed by `/users/search`, which is deliberately
 * narrow: prefix of 2+, capped results, username and display name only —
 * never an email or a user id (DECISIONS #37).
 */
export function UsernameAutocomplete({
  id,
  label,
  value,
  onChange,
  onSubmit,
  error,
}: UsernameAutocompleteProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Debounced so a fast typist doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), 200);
    return () => clearTimeout(timer);
  }, [value]);

  const enabled = debounced.length >= LIMITS.USER_SEARCH_MIN_CHARS;
  const { data: results } = useQuery({
    enabled,
    queryKey: ['users', 'search', debounced],
    queryFn: () => searchUsers(debounced),
    staleTime: 60_000,
  });

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // An exact match needs no suggestion list — the user has already typed it.
  const suggestions = (results ?? []).filter((u) => u.username !== value);
  const showList = open && enabled && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <FieldShell id={id} label={label} error={error}>
        <input
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t('collab.usernamePlaceholder')}
          value={value}
          onChange={(e) => {
            onChange(sanitize(e.target.value));
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter') {
              // Stop the keypress reaching any enclosing form, which would
              // submit *that* instead (the milestone editor, for example).
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              onSubmit?.();
            }
          }}
          className={inputClasses}
        />
      </FieldShell>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-border bg-surface-elevated py-1 shadow-lg"
        >
          {suggestions.map((user) => (
            <li key={user.username}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onChange(user.username);
                  setOpen(false);
                }}
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left hover:bg-surface"
              >
                <span className="font-mono text-sm text-text">@{user.username}</span>
                <span className="truncate text-xs text-text-muted">{user.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
