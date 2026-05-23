export const APP_NAME = 'Ark';
export const APP_SLOGAN = "Noé's Ark for the offline age";
export const APP_TAGLINE = 'Maps. Knowledge. Notes. AI. Offline.';

export const SAFETY_COPY = {
  medical: 'Offline reference only. Not a substitute for professional medical advice.',
  foraging: 'Do not eat wild plants or mushrooms based only on this app.',
  ai: 'AI can be wrong. Verify critical survival/medical information.',
};

export const APP_DIRECTORIES = ['content', 'maps', 'models', 'imports', 'cache'] as const;

export type AppDirectory = (typeof APP_DIRECTORIES)[number];
