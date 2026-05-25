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
    if (state.isInternetReachable === true) return true;
    if (String(state.type).toLowerCase() === 'vpn' && state.isConnected === true) return true;
    if (state.isInternetReachable === false) return false;
    if (state.isConnected === true) return true;
    return state.type !== 'none' && state.type !== 'unknown';
  }

  static label(state: NetInfoState | null) {
    if (!state) return 'Checking';
    return this.isOnline(state) ? 'Online' : 'Offline';
  }
}
