import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export class NetworkService {
  static async getState() {
    return NetInfo.fetch();
  }

  static subscribe(listener: (state: NetInfoState) => void) {
    return NetInfo.addEventListener(listener);
  }

  static label(state: NetInfoState | null) {
    if (!state) return 'Checking';
    return state.isConnected && state.isInternetReachable !== false ? 'Online' : 'Offline';
  }
}
