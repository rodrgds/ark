import { Redirect } from 'expo-router';

export default function DiagnosticsRedirect() {
  return <Redirect href={{ pathname: '/(tabs)/settings', params: { tab: 'advanced' } }} />;
}
