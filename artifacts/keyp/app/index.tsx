import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function Index() {
  const { user, isLoading, isOnboarded } = useAuth();
  const colors = useColors();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!isOnboarded) return <Redirect href="/onboarding" />;
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(tabs)" />;
}
