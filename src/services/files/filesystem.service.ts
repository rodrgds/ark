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
    return {
      directories: dirs,
      note: 'Detailed recursive size accounting is deferred; directories are ready for downloads/imports.',
    };
  }
}
