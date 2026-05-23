import { Stack } from 'expo-router';

export default function DocumentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#000000' },
        headerTintColor: '#FAFAFA',
        contentStyle: { backgroundColor: '#000000' },
      }}
    />
  );
}
