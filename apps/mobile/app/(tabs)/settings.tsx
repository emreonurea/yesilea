import { useState } from "react";
import { Share, Text } from "react-native";
import { confirmAction } from "../../lib/dialog";
import { router } from "expo-router";
import { ALLERGEN_LABELS, DISCLAIMER_RELIGIOUS } from "@menu/shared";
import { api, LOCAL_MODE } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { THEMES, useTheme } from "../../lib/theme";
import { Pressable, View } from "react-native";
import { Button, Card, colors, ErrorText, Muted, Screen } from "../../components/ui";

export default function Settings() {
  const { me, signOut, refresh } = useAuth();
  const { theme, setTheme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const p = me?.profile;

  async function exportData() {
    try {
      const data = await api.exportData();
      await Share.share({ message: JSON.stringify(data, null, 2) });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const confirmHealth = () =>
    confirmAction("Sağlık verilerini sil", "Alerjileriniz, vücut bilgileriniz ve tüm yemek, su ve kilo kayıtlarınız silinecek; diyet programı kapanacak. Bu işlem geri alınamaz.", "Sil", async () => { try { await api.deleteHealthData(); await refresh(); } catch (e) { setError((e as Error).message); } }, true);

  const confirmDelete = () =>
    confirmAction("Hesabı sil", "Hesabınız ve tüm verileriniz (profil, malzemeler, menüler, fiyatlar) kalıcı olarak silinecek. Bu işlem geri alınamaz.", "Kalıcı olarak sil", async () => {
          try { await api.deleteAccount(); await signOut(); } catch (e) { setError((e as Error).message); }
        }, true);

  return (
    <Screen>
      {p ? (
        <Card>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>Profil</Text>
          <Muted>{p.household_size} kişi · {p.diet === "hepsi" ? "diyet kısıtı yok" : p.diet}{p.weekly_budget_try ? ` · ${p.weekly_budget_try} TL/hafta` : ""}</Muted>
          {p.allergies.length ? <Muted>Alerjiler: {p.allergies.map((a) => ALLERGEN_LABELS[a]).join(", ")}</Muted> : null}
          <Muted>Helal hassasiyeti: {p.halal_sensitive ? "açık" : "kapalı"}</Muted>
          <Button title="Profili düzenle" kind="secondary" onPress={() => router.push("/profile")} />
          <Button title="Birim fiyatlar" kind="secondary" onPress={() => router.push("/prices")} />
        </Card>
      ) : null}

      <Card>
        <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 10 }}>Renk teması</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {THEMES.map((th) => (
            <Pressable key={th.key} onPress={() => setTheme(th.key)} accessibilityLabel={`${th.label} tema`} accessibilityState={{ selected: theme.key === th.key }}
              style={{ alignItems: "center", marginRight: 14, marginBottom: 8 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: th.primary, borderWidth: theme.key === th.key ? 3 : 0, borderColor: "#111" }} />
              <Text style={{ fontSize: 12, color: colors.text, marginTop: 4 }}>{th.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>Üyelik</Text>
        <Muted>{me?.premium ? "👑 Premium aktif" : "Ücretsiz sürüm: haftalık sınırlı menü ve öneri"}</Muted>
        <Button title={me?.premium ? "Premium ayrıntıları" : "Premium'a geç"} kind="secondary" onPress={() => router.push("/premium")} />
      </Card>

      <Card>
        <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>Gizlilik ve verileriniz</Text>
        {me?.email ? <Muted>{me.email}</Muted> : null}
        <Button title="Gizlilik politikası" kind="secondary" onPress={() => router.push("/privacy")} />
        <Button title="Kullanım koşulları" kind="secondary" onPress={() => router.push("/terms")} />
        <Button title="Verilerimi indir" kind="secondary" onPress={exportData} />
        {me?.profile.health_consent_at ? <Button title="Sağlık verilerimi sil, rızamı geri al" kind="secondary" onPress={confirmHealth} /> : null}
        {LOCAL_MODE ? (
          <Muted style={{ marginVertical: 6 }}>Bu sürümde hesap yok: tüm verileriniz yalnızca bu cihazda, tarayıcınızda saklanır ve hiçbir yere gönderilmez.</Muted>
        ) : (
          <Button title="Çıkış yap" kind="secondary" onPress={signOut} />
        )}
        <Button title={LOCAL_MODE ? "Tüm verilerimi sil" : "Hesabımı sil"} kind="danger" onPress={confirmDelete} />
      </Card>

      <ErrorText error={error} />
      <Muted style={{ fontSize: 12 }}>{DISCLAIMER_RELIGIOUS}</Muted>
      <Muted style={{ fontSize: 11, marginTop: 12, textAlign: "center" }}>Sürüm: {process.env.EXPO_PUBLIC_BUILD ?? "geliştirme"}</Muted>
    </Screen>
  );
}
