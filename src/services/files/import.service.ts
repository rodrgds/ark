import { randomUUID } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Linking } from 'react-native';
import { DocumentsRepository } from '@/services/db/repositories/documents.repo';
import { FileSystemService } from '@/services/files/filesystem.service';

export class ImportService {
  static async pickDocument() {
    return DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  }

  static listDocuments() {
    return DocumentsRepository.list();
  }

  static getDocument(id: string) {
    return DocumentsRepository.get(id);
  }

  static async importDocument() {
    const result = await this.pickDocument();
    if (result.canceled) return null;

    const asset = result.assets[0];
    if (!asset) return null;

    await FileSystemService.ensureAppDirectories();
    const id = randomUUID();
    const safeName = FileSystemService.safeFileName(asset.name || 'document');
    const localUri = `${FileSystemService.dir('imports')}${id}-${safeName}`;
    await FileSystem.copyAsync({ from: asset.uri, to: localUri });

    const info = await FileSystem.getInfoAsync(localUri);
    const storedSize = info.exists && 'size' in info ? (info.size ?? asset.size ?? null) : null;

    return DocumentsRepository.create({
      id,
      title: asset.name || 'Imported document',
      mimeType: asset.mimeType ?? null,
      localUri,
      sizeBytes: storedSize,
      source: 'document-picker',
      encryptionStatus: 'plaintext',
    });
  }

  static async openDocument(id: string) {
    const document = await DocumentsRepository.get(id);
    if (!document?.localUri) throw new Error('Document file is not available.');
    const canOpen = await Linking.canOpenURL(document.localUri);
    if (!canOpen) throw new Error('No app is available to open this file.');
    await Linking.openURL(document.localUri);
  }

  static async deleteDocument(id: string) {
    const document = await DocumentsRepository.get(id);
    if (document?.localUri) await FileSystemService.deleteByUri(document.localUri);
    await DocumentsRepository.delete(id);
  }
}
