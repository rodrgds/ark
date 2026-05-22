import * as DocumentPicker from 'expo-document-picker';

export class ImportService {
  static async pickDocument() {
    return DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  }
}
