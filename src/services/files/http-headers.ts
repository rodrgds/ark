type HeaderPlatform = string | null | undefined;

export const ARK_DOWNLOAD_ACCEPT = 'application/pdf,application/zim,application/octet-stream,*/*';

const USER_AGENTS = {
  android:
    'Mozilla/5.0 (Linux; Android 14; Ark Offline) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Mobile Safari/537.36',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X; Ark Offline) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  web: 'Mozilla/5.0 (Ark Offline; Web) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36',
  generic: 'Mozilla/5.0 (Mobile; Ark Offline) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36',
};

export function arkUserAgent(platform: HeaderPlatform = runtimePlatform()) {
  const normalized = platform?.toLowerCase();
  if (normalized === 'android') return USER_AGENTS.android;
  if (normalized === 'ios') return USER_AGENTS.ios;
  if (normalized === 'web') return USER_AGENTS.web;
  return USER_AGENTS.generic;
}

export function arkDownloadHeaders(options: { accept?: string; platform?: HeaderPlatform } = {}) {
  return {
    Accept: options.accept ?? ARK_DOWNLOAD_ACCEPT,
    'Accept-Encoding': 'identity',
    'User-Agent': arkUserAgent(options.platform),
  };
}

function runtimePlatform(): HeaderPlatform {
  // The process global is absent in some runtimes; optional access treats
  // that the same as missing env vars.
  // SAFETY: only the Node-style process.env bag is read here, never assigned.
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.EXPO_OS ?? env?.EXPO_PLATFORM ?? null;
}
