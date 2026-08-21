const STORAGE_KEY = 'timeline.tutorialSeen';

/** Browser-level, like the theme preference — not tied to a specific account. */
export function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // Best-effort; a failed write just means it offers itself again next visit.
  }
}
