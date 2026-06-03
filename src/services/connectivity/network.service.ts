import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export class NetworkService {
  static async getState() {
    return NetInfo.fetch();
  }

  static subscribe(listener: (state: NetInfoState) => void) {
    return NetInfo.addEventListener(listener);
  }

  static isOnline(state: NetInfoState | null) {
    if (!state) return null;
    const type = String(state.type).toLowerCase();

    if (state.isInternetReachable === true) return true;
    if (state.isInternetReachable === false) return false;
    if (type === 'none' || type === 'unknown' || type === 'vpn') return false;
    if (state.isConnected === true) return true;
    return false;
  }

  static isWifi(state: NetInfoState | null) {
    return String(state?.type ?? '').toLowerCase() === 'wifi' && this.isOnline(state) === true;
  }

  static label(state: NetInfoState | null) {
    if (!state) return 'Checking';
    return this.isOnline(state) ? 'Online' : 'Offline';
  }
}
