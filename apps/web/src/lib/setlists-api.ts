import type { SetlistData } from '@timeline/shared';
import { apiClient } from './api-client';

/** Server-side cached; the API key never reaches the browser. */
export function getSetlist(setlistId: string): Promise<SetlistData> {
  return apiClient.get<SetlistData>(`/setlists/${setlistId}`);
}
