import * as FileSystem from 'expo-file-system/legacy';
import { APP_DIRECTORIES, type AppDirectory } from '@/constants/app';

export class FileSystemService {
  static baseDir() {
    return `${FileSystem.documentDirectory ?? ''}ark/`;
  }

  static dir(name: AppDirectory) {
    return `${this.baseDir()}${name}/`;
  }

  static async ensureAppDirectories() {
    const base = this.baseDir();
    if (!base) return {};
    await FileSystem.makeDirectoryAsync(base, { intermediates: true }).catch(() => undefined);
    const dirs: Record<string, string> = {};
    for (const directory of APP_DIRECTORIES) {
      const uri = this.dir(directory);
      await FileSystem.makeDirectoryAsync(uri, { intermediates: true }).catch(() => undefined);
      dirs[directory] = uri;
    }
    return dirs;
  }

  static async deleteByUri(uri: string) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  }

  static async getStorageSummary() {
    const dirs = await this.ensureAppDirectories();
    let totalBytes = 0;
    const directorySizes: Record<string, number> = {};
    for (const [name, uri] of Object.entries(dirs)) {
      const size = await this.sizeOfDirectory(uri);
      directorySizes[name] = size;
      totalBytes += size;
    }
    return {
      directories: dirs,
      directorySizes,
      totalBytes,
      label: `${this.formatBytes(totalBytes)} stored offline`,
    };
  }

  private static async sizeOfDirectory(uri: string): Promise<number> {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return 0;
    if (!info.isDirectory) return 'size' in info ? (info.size ?? 0) : 0;
    const names = await FileSystem.readDirectoryAsync(uri).catch(() => []);
    const sizes = await Promise.all(names.map((name) => this.sizeOfDirectory(`${uri}${name}`)));
    return sizes.reduce((sum, size) => sum + size, 0);
  }

  static formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }

  static safeFileName(name: string) {
    return name
      .replace(/[^\w.\- ]+/g, '_')
      .replace(/\s+/g, '-')
      .slice(0, 120);
  }
}
