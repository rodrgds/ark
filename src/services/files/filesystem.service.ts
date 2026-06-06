import * as FileSystem from 'expo-file-system/legacy';
import { APP_DIRECTORIES, type AppDirectory } from '@/constants/app';

export class FileSystemService {
  private static readonly LOW_STORAGE_MINIMUM_BYTES = 1024 * 1024 * 1024;

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

  static async copyToAppDirectory(input: {
    sourceUri: string;
    directory: AppDirectory;
    fileName: string;
  }) {
    await this.ensureAppDirectories();
    const safeName = this.safeFileName(input.fileName);
    const destination = `${this.dir(input.directory)}${Date.now()}-${safeName}`;
    await FileSystem.copyAsync({ from: input.sourceUri, to: destination });
    return destination;
  }

  static async getStorageSummary() {
    const dirs = await this.ensureAppDirectories();
    const capacity = await this.getDiskCapacity();
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
      freeBytes: capacity.freeBytes,
      totalDiskBytes: capacity.totalBytes,
      label: `${this.formatBytes(totalBytes)} stored offline`,
    };
  }

  static async ensureSpaceForDownload(
    sizeBytes?: number | null,
    options: { alreadyOnDiskBytes?: number | null } = {}
  ) {
    if (!sizeBytes) return;
    const capacity = await this.getDiskCapacity();
    if (capacity.freeBytes == null) return;
    const alreadyOnDisk = Math.max(0, options.alreadyOnDiskBytes ?? 0);
    const remainingBytes = Math.max(0, sizeBytes - alreadyOnDisk);
    const reserveBytes = Math.max(200 * 1024 * 1024, Math.round(sizeBytes * 0.1));
    if (capacity.freeBytes < remainingBytes + reserveBytes) {
      throw new Error(
        `Not enough free storage. This download needs about ${this.formatBytes(
          remainingBytes
        )} more, with at least ${this.formatBytes(reserveBytes)} left for Ark to finish safely.`
      );
    }
  }

  static getLowStorageWarning(summary: {
    freeBytes?: number | null;
    totalDiskBytes?: number | null;
  }) {
    if (summary.freeBytes == null) return null;
    const reserveBytes = Math.max(
      this.LOW_STORAGE_MINIMUM_BYTES,
      summary.totalDiskBytes ? Math.round(summary.totalDiskBytes * 0.05) : 0
    );
    if (summary.freeBytes >= reserveBytes) return null;
    return `Low storage: ${this.formatBytes(
      summary.freeBytes
    )} free. Keep at least ${this.formatBytes(reserveBytes)} free before large downloads.`;
  }

  static async getDiskCapacity() {
    const [freeBytes, totalBytes] = await Promise.all([
      FileSystem.getFreeDiskStorageAsync().catch(() => null),
      FileSystem.getTotalDiskCapacityAsync().catch(() => null),
    ]);
    return { freeBytes, totalBytes };
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
