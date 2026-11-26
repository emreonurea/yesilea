import { useEffect } from "react";
import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/auth";
import { colors, Loading } from "../components/ui";
import { ThemeProvider } from "../lib/theme";

function Gate() {
  const { ready, signedIn, me } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (!ready) return;
    const first = segments[0] as string | undefined;
    const atLogin = first === "login";
    const atPublic = atLogin || first === "privacy" || first === "terms";
    if (!signedIn && !atPublic) router.replace("/login");
    else if (signedIn && me && !me.has_profile && first !== "onboarding") router.replace("/onboarding");
    else if (signedIn && atLogin) router.replace("/");
  }, [ready, signedIn, me, segments]);

  if (!ready) return <Loading />;
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary, headerBackTitle: "Geri" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: "Giriş" }} />
      <Stack.Screen name="onboarding" options={{ title: "Profiliniz", headerBackVisible: false }} />
      <Stack.Screen name="profile" options={{ title: "Profili düzenle" }} />
      <Stack.Screen name="prices" options={{ title: "Birim fiyatlar" }} />
      <Stack.Screen name="diet-recipes" options={{ title: "Diyet yemekleri" }} />
      <Stack.Screen name="my-recipes" options={{ title: "Yemeklerim" }} />
      <Stack.Screen name="tonight" options={{ title: "Bu akşam" }} />
      <Stack.Screen name="pantry" options={{ title: "Evdekiler" }} />
      <Stack.Screen name="notes" options={{ title: "Notlarım" }} />
      <Stack.Screen name="premium" options={{ title: "Premium" }} />
      <Stack.Screen name="body" options={{ title: "Diyet programım" }} />
      <Stack.Screen name="privacy" options={{ title: "Gizlilik" }} />
      <Stack.Screen name="terms" options={{ title: "Kullanım koşulları" }} />
      <Stack.Screen name="recipe/[id]" options={{ title: "Tarif" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Gate />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
