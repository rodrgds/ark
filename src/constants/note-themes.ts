import type { ThemePreference } from '@/constants/theme';

export const NOTE_THEME_IDS = [
  'default',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
  'beach',
  'forest',
] as const;

export type NoteThemeId = (typeof NOTE_THEME_IDS)[number];

export type NoteThemeVariant = {
  background: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  chipBackground: string;
  chipForeground: string;
};

export type NoteThemeDefinition = {
  id: NoteThemeId;
  label: string;
  variants: Record<ThemePreference, NoteThemeVariant>;
};

export const DEFAULT_NOTE_THEME_ID: NoteThemeId = 'default';

const defaultTheme = {
  light: {
    background: '#FAFAF7',
    foreground: '#151511',
    mutedForeground: '#6E6A5F',
    border: '#DED9CC',
    chipBackground: '#EEE8DA',
    chipForeground: '#2F2B21',
  },
  dark: {
    background: '#171914',
    foreground: '#F4F2EA',
    mutedForeground: '#B3AD9F',
    border: '#373A30',
    chipBackground: '#2A2D25',
    chipForeground: '#E8E2D2',
  },
  oled: {
    background: '#080906',
    foreground: '#F4F2EA',
    mutedForeground: '#AAA596',
    border: '#2B2E26',
    chipBackground: '#1B1D18',
    chipForeground: '#E6DFC9',
  },
} satisfies Record<ThemePreference, NoteThemeVariant>;

export const NOTE_THEMES: Record<NoteThemeId, NoteThemeDefinition> = {
  default: {
    id: 'default',
    label: 'Default',
    variants: defaultTheme,
  },
  red: {
    id: 'red',
    label: 'Red',
    variants: {
      light: {
        background: '#FFF1F0',
        foreground: '#3A1210',
        mutedForeground: '#8C4B45',
        border: '#F2C8C3',
        chipBackground: '#FADFDA',
        chipForeground: '#5A1D19',
      },
      dark: {
        background: '#241312',
        foreground: '#FCEDEA',
        mutedForeground: '#D59A93',
        border: '#613530',
        chipBackground: '#3A1D1A',
        chipForeground: '#F7D3CC',
      },
      oled: {
        background: '#150907',
        foreground: '#FCEDEA',
        mutedForeground: '#C58D86',
        border: '#4A2924',
        chipBackground: '#2A1210',
        chipForeground: '#F5C9C0',
      },
    },
  },
  orange: {
    id: 'orange',
    label: 'Orange',
    variants: {
      light: {
        background: '#FFF3E5',
        foreground: '#35200C',
        mutedForeground: '#835326',
        border: '#EFCB9F',
        chipBackground: '#F7E2C5',
        chipForeground: '#51310E',
      },
      dark: {
        background: '#21160B',
        foreground: '#FBEFDB',
        mutedForeground: '#D1AA78',
        border: '#5B3B1D',
        chipBackground: '#342211',
        chipForeground: '#F2D4AA',
      },
      oled: {
        background: '#120A04',
        foreground: '#FBEFDB',
        mutedForeground: '#C49A68',
        border: '#432B15',
        chipBackground: '#26170A',
        chipForeground: '#EFCB98',
      },
    },
  },
  yellow: {
    id: 'yellow',
    label: 'Yellow',
    variants: {
      light: {
        background: '#FFF8D8',
        foreground: '#302805',
        mutedForeground: '#756619',
        border: '#E7D787',
        chipBackground: '#F2E8B3',
        chipForeground: '#463A08',
      },
      dark: {
        background: '#1E1A09',
        foreground: '#F7F0C8',
        mutedForeground: '#C7B969',
        border: '#514715',
        chipBackground: '#302A0C',
        chipForeground: '#EADD90',
      },
      oled: {
        background: '#100D03',
        foreground: '#F7F0C8',
        mutedForeground: '#B8AA5E',
        border: '#3A330E',
        chipBackground: '#211C06',
        chipForeground: '#E6D57F',
      },
    },
  },
  green: {
    id: 'green',
    label: 'Green',
    variants: {
      light: {
        background: '#EDF8E8',
        foreground: '#122511',
        mutedForeground: '#4D7745',
        border: '#BED9B4',
        chipBackground: '#DCEFD4',
        chipForeground: '#1F3A1B',
      },
      dark: {
        background: '#101D10',
        foreground: '#ECF6E8',
        mutedForeground: '#A1C595',
        border: '#32502D',
        chipBackground: '#1A2E18',
        chipForeground: '#CAE8BE',
      },
      oled: {
        background: '#071006',
        foreground: '#ECF6E8',
        mutedForeground: '#93B988',
        border: '#263D21',
        chipBackground: '#10200E',
        chipForeground: '#BFE2B3',
      },
    },
  },
  teal: {
    id: 'teal',
    label: 'Teal',
    variants: {
      light: {
        background: '#E7F7F3',
        foreground: '#0B2824',
        mutedForeground: '#42766E',
        border: '#AED8CF',
        chipBackground: '#D2EFE8',
        chipForeground: '#143C36',
      },
      dark: {
        background: '#0C1D1A',
        foreground: '#E7F7F3',
        mutedForeground: '#92C7BE',
        border: '#2A504A',
        chipBackground: '#162F2B',
        chipForeground: '#C1E9E2',
      },
      oled: {
        background: '#04100E',
        foreground: '#E7F7F3',
        mutedForeground: '#84B9B0',
        border: '#203C37',
        chipBackground: '#0D211E',
        chipForeground: '#B5E4DC',
      },
    },
  },
  blue: {
    id: 'blue',
    label: 'Blue',
    variants: {
      light: {
        background: '#EDF5FF',
        foreground: '#10233A',
        mutedForeground: '#486F99',
        border: '#B9D3EF',
        chipBackground: '#DCEBFA',
        chipForeground: '#193756',
      },
      dark: {
        background: '#101A25',
        foreground: '#EEF6FF',
        mutedForeground: '#9FBDDA',
        border: '#304A66',
        chipBackground: '#1B2B3C',
        chipForeground: '#CCE3FA',
      },
      oled: {
        background: '#070D14',
        foreground: '#EEF6FF',
        mutedForeground: '#91AFCB',
        border: '#25384E',
        chipBackground: '#111D29',
        chipForeground: '#C0DCF6',
      },
    },
  },
  purple: {
    id: 'purple',
    label: 'Purple',
    variants: {
      light: {
        background: '#F5F0FF',
        foreground: '#271B3A',
        mutedForeground: '#71599A',
        border: '#D6C5EF',
        chipBackground: '#E8DFFA',
        chipForeground: '#382753',
      },
      dark: {
        background: '#1B1623',
        foreground: '#F5EEFF',
        mutedForeground: '#BCA8DC',
        border: '#4B3B64',
        chipBackground: '#2A2138',
        chipForeground: '#E2D2FA',
      },
      oled: {
        background: '#0D0912',
        foreground: '#F5EEFF',
        mutedForeground: '#AF9AD0',
        border: '#392D4B',
        chipBackground: '#1D1629',
        chipForeground: '#D9C8F4',
      },
    },
  },
  pink: {
    id: 'pink',
    label: 'Pink',
    variants: {
      light: {
        background: '#FFF0F6',
        foreground: '#351528',
        mutedForeground: '#8A4D6F',
        border: '#EDC0D5',
        chipBackground: '#F8DDEB',
        chipForeground: '#531D3B',
      },
      dark: {
        background: '#22131A',
        foreground: '#FCEFF5',
        mutedForeground: '#D79CB8',
        border: '#5D3448',
        chipBackground: '#361F2B',
        chipForeground: '#F3D1E2',
      },
      oled: {
        background: '#13070D',
        foreground: '#FCEFF5',
        mutedForeground: '#C78EA8',
        border: '#462737',
        chipBackground: '#26111A',
        chipForeground: '#F0C5DA',
      },
    },
  },
  beach: {
    id: 'beach',
    label: 'Beach',
    variants: {
      light: {
        background: '#F5F0DA',
        foreground: '#1E2B2D',
        mutedForeground: '#647066',
        border: '#D8CDA8',
        chipBackground: '#DCEBD8',
        chipForeground: '#233B37',
      },
      dark: {
        background: '#171A15',
        foreground: '#F1EBD7',
        mutedForeground: '#B9B091',
        border: '#454536',
        chipBackground: '#25332C',
        chipForeground: '#D7E7CF',
      },
      oled: {
        background: '#0A0B08',
        foreground: '#F1EBD7',
        mutedForeground: '#AAA282',
        border: '#343326',
        chipBackground: '#18241E',
        chipForeground: '#D1E1C8',
      },
    },
  },
  forest: {
    id: 'forest',
    label: 'Forest',
    variants: {
      light: {
        background: '#EAF1E2',
        foreground: '#172215',
        mutedForeground: '#5B7052',
        border: '#C3D2B8',
        chipBackground: '#D9E7CF',
        chipForeground: '#24341F',
      },
      dark: {
        background: '#11180F',
        foreground: '#EEF5EA',
        mutedForeground: '#A8BDA0',
        border: '#34422E',
        chipBackground: '#1D2918',
        chipForeground: '#CEE0C6',
      },
      oled: {
        background: '#060B05',
        foreground: '#EEF5EA',
        mutedForeground: '#99AF91',
        border: '#283323',
        chipBackground: '#121D0F',
        chipForeground: '#C4D9BB',
      },
    },
  },
};

export const NOTE_THEME_OPTIONS = NOTE_THEME_IDS.map((id) => NOTE_THEMES[id]);

export function isNoteThemeId(value: string | null | undefined): value is NoteThemeId {
  return NOTE_THEME_IDS.includes(value as NoteThemeId);
}

export function normalizeNoteThemeId(value: string | null | undefined): NoteThemeId {
  return isNoteThemeId(value) ? value : DEFAULT_NOTE_THEME_ID;
}

export function getNoteTheme(themeId: string | null | undefined, effectiveTheme: ThemePreference) {
  return NOTE_THEMES[normalizeNoteThemeId(themeId)].variants[effectiveTheme];
}
