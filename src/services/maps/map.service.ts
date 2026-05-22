export class MapService {
  static getRuntimeStatus() {
    return {
      available: false,
      reason: '@maplibre/maplibre-react-native is not installed in this Expo Go build.',
    };
  }
}
