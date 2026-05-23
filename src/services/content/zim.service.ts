import type { ContentPack } from '@/types/content';

export class ZimService {
  static getReaderStatus(pack?: ContentPack | null) {
    if (!pack) return 'Select a ZIM archive to inspect it.';
    if (!pack.installed) return 'Download this archive before opening it offline.';
    return 'ZIM archive is stored locally. Use Open File to hand it to Kiwix or another ZIM-capable reader.';
  }

  static getKiwixJsUrl() {
    return 'https://pwa.kiwix.org';
  }

  static getLimitations() {
    return [
      'Native in-app ZIM browsing needs a libzim bridge or bundled Kiwix JS with file access.',
      'React Native WebView cannot reliably grant Kiwix JS direct access to app-private multi-GB ZIM files.',
      'The downloaded archive remains fully usable through a ZIM reader such as Kiwix.',
    ];
  }
}
