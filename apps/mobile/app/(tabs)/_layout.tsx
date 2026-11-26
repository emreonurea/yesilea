import { ErrorScreen } from "../../components/ErrorScreen";
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "../../components/ui";

const icon = (glyph: string) => ({ color }: { color: string }) => <Text style={{ fontSize: 18, color }}>{glyph}</Text>;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerTintColor: "#2B2620" }}>
      <Tabs.Screen name="index" options={{ title: "Ana sayfa", headerShown: false, tabBarIcon: icon("🏠") }} />
      <Tabs.Screen name="menu" options={{ title: "Haftalık menü", tabBarLabel: "Menü", tabBarIcon: icon("📅") }} />
      <Tabs.Screen name="list" options={{ title: "Market listesi", tabBarLabel: "Market", tabBarIcon: icon("🛒") }} />
      <Tabs.Screen name="nutrition" options={{ title: "Beslenme", tabBarIcon: icon("🥗") }} />
      <Tabs.Screen name="settings" options={{ title: "Ayarlar", tabBarIcon: icon("⚙️") }} />
    </Tabs>
  );
}

export function ErrorBoundary(props: { error: Error; retry: () => Promise<void> }) {
  return <ErrorScreen {...props} />;
}
