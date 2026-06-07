import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

const STATE_DEBOUNCE_MS = 5_000;

export class NetworkService {
  static async getState() {
    return NetInfo.fetch();
  }

  static subscribe(listener: (state: NetInfoState) => void) {
    return NetInfo.addEventListener(listener);
  }

  static subscribeDebounced(
    listener: (state: NetInfoState) => void,
    debounceMs: number = STATE_DEBOUNCE_MS
  ) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let latestState: NetInfoState | null = null;
    const flush = () => {
      timer = null;
      if (latestState) listener(latestState);
    };
    return NetInfo.addEventListener((state) => {
      latestState = state;
      if (timer) return;
      timer = setTimeout(flush, debounceMs);
    });
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
