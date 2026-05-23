export type LabelColorMap = Record<string, string>;

export type LabelColorOption = {
  name: string;
  value: string;
};

export const LABEL_DEFAULT_COLOR = '#52525b';

export const LABEL_COLOR_OPTIONS: LabelColorOption[] = [
  { name: 'Slate', value: '#475569' },
  { name: 'Gray', value: '#6b7280' },
  { name: 'Zinc', value: '#52525b' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Yellow', value: '#ca8a04' },
  { name: 'Lime', value: '#65a30d' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Teal', value: '#0f766e' },
  { name: 'Cyan', value: '#0891b2' },
  { name: 'Sky', value: '#0284c7' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Fuchsia', value: '#c026d3' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Rose', value: '#e11d48' },
];

function normalizeHexColor(color: string | undefined | null) {
  if (!color) return LABEL_DEFAULT_COLOR;
  const normalized = color.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : LABEL_DEFAULT_COLOR;
}

export function getLabelColor(label: string, colors: LabelColorMap) {
  return normalizeHexColor(colors[label]);
}

export function getLabelForegroundColor(background: string) {
  const color = normalizeHexColor(background);
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance >= 150 ? '#0a0a0a' : '#ffffff';
}
