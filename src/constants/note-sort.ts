export const NOTE_SORT_MODES = ['manual', 'updated_desc', 'updated_asc', 'title'] as const;

export type NoteSortMode = (typeof NOTE_SORT_MODES)[number];

export const DEFAULT_NOTE_SORT_MODE: NoteSortMode = 'updated_desc';

export const NOTE_SORT_OPTIONS: Array<{
  value: NoteSortMode;
  label: string;
}> = [
  { value: 'updated_desc', label: 'Newest' },
  { value: 'updated_asc', label: 'Oldest' },
  { value: 'title', label: 'Title' },
  { value: 'manual', label: 'Manual' },
];

export function isNoteSortMode(value: string | null | undefined): value is NoteSortMode {
  // SAFETY: NOTE_SORT_MODES holds every valid sort mode, so a match proves
  // the value is one of them.
  return (NOTE_SORT_MODES as readonly string[]).includes(value ?? '');
}

export function normalizeNoteSortMode(value: string | null | undefined): NoteSortMode {
  return isNoteSortMode(value) ? value : DEFAULT_NOTE_SORT_MODE;
}

export function getNoteSortLabel(sortMode: NoteSortMode) {
  return NOTE_SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? 'Newest';
}
