import { segmentMentions } from '@timeline/shared';

interface MentionTextProps {
  text: string;
  /** Usernames the server actually resolved to real users. */
  mentions?: readonly { username: string }[];
}

/**
 * Renders text with resolved `@username` references highlighted. Only mentions
 * the server confirmed are marked — an unresolved `@handle` stays plain text,
 * so the UI can never imply a user exists when they don't (DECISIONS #37).
 */
export function MentionText({ text, mentions }: MentionTextProps) {
  const known = mentions?.map((m) => m.username) ?? [];
  const segments = segmentMentions(text, known);

  return (
    <p className="whitespace-pre-wrap text-base text-text-secondary">
      {segments.map((segment, i) =>
        segment.type === 'mention' ? (
          <span key={i} className="font-medium text-accent">
            @{segment.value}
          </span>
        ) : (
          <span key={i}>{segment.value}</span>
        ),
      )}
    </p>
  );
}
