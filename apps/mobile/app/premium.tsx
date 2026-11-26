import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { PLAN_FEATURES, PRICE_PLANS, type PricePlan } from "@menu/shared";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, Card, colors, ErrorText, Muted, Screen } from "../components/ui";

const GOLD = "#B45309";

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Text style={{ color: colors.ok, fontSize: 16 }}>✓</Text>;
  if (v === false) return <Text style={{ color: colors.muted, fontSize: 16 }}>—</Text>;
  return <Text style={{ fontSize: 12, color: colors.text, textAlign: "center" }}>{v}</Text>;
}

export default function Premium() {
  const { me, refresh } = useAuth();
  const [plan, setPlan] = useState<PricePlan["id"]>("yillik");
  const [error, setError] = useState<string | null>(null);
  const premium = !!me?.premium;
  const [testMode, setTestMode] = useState(__DEV__);
  useEffect(() => { api.health().then((h) => setTestMode(__DEV__ || h.test)).catch(() => {}); }, []);

  function buy() {
    Alert.alert(
      "Ödeme henüz bağlı değil",
      "Satın alma, uygulama App Store ve Google Play'e yüklendiğinde mağazanın ödeme sistemiyle çalışacak. Şimdilik aşağıdaki geliştirici düğmesiyle Premium'u deneyebilirsiniz.",
    );
  }

  async function devToggle(on: boolean) {
    setError(null);
    try {
      await fetchDev(on);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen>
      <View style={{ backgroundColor: "#FEF3C7", borderRadius: 20, padding: 20, marginBottom: 12 }}>
        <Text style={{ fontSize: 34 }}>👑</Text>
        <Text style={{ fontSize: 24, fontWeight: "800", color: GOLD, marginTop: 4 }}>Yeşilea Premium</Text>
        <Text style={{ color: colors.text, marginTop: 6 }}>
          Sınırsız menü ve öneri, kişisel diyet programı, makro ve mikro besin takibi.
        </Text>
        {premium ? <Text style={{ color: colors.ok, fontWeight: "700", marginTop: 10 }}>Premium üyeliğiniz aktif ✓</Text> : null}
      </View>

      <Card>
        <View style={{ flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ flex: 1, fontWeight: "700", color: colors.text }}>Özellik</Text>
          <Text style={{ width: 80, textAlign: "center", fontWeight: "700", color: colors.muted }}>Ücretsiz</Text>
          <Text style={{ width: 80, textAlign: "center", fontWeight: "700", color: GOLD }}>Premium</Text>
        </View>
        {PLAN_FEATURES.map((f) => (
          <View key={f.label} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F3EEE7" }}>
            <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>{f.label}</Text>
            <View style={{ width: 80, alignItems: "center" }}><Cell v={f.free} /></View>
            <View style={{ width: 80, alignItems: "center" }}><Cell v={f.premium} /></View>
          </View>
        ))}
      </Card>

      {!premium ? (
        <>
          {PRICE_PLANS.map((p) => (
            <Pressable key={p.id} onPress={() => setPlan(p.id)} accessibilityRole="radio" accessibilityState={{ selected: plan === p.id }}
              style={{ borderWidth: 2, borderColor: plan === p.id ? GOLD : colors.border, backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{p.title}</Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: GOLD }}>{p.price}</Text>
              </View>
              <Muted style={{ marginTop: 2 }}>{p.note}</Muted>
            </Pressable>
          ))}
          <Button title="Premium'a geç" onPress={buy} />
          <Button title="Satın alımları geri yükle" kind="secondary" onPress={() =>
            Alert.alert("Geri yükleme", "Mağaza ödeme sistemi bağlandığında daha önce aldığınız abonelik buradan geri yüklenecek.")} />
          <Muted style={{ fontSize: 12, marginTop: 6 }}>
            Fiyatlar örnektir. Abonelik, App Store / Google Play hesabınız üzerinden ücretlendirilir; dönem bitiminden en az 24 saat önce iptal edilmezse aynı süre ve ücretle otomatik yenilenir. Aboneliği mağaza hesap ayarlarınızdan yönetebilir ve iptal edebilirsiniz.
          </Muted>
          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 8 }}>
            <Text style={{ color: colors.primary, marginRight: 16 }} onPress={() => router.push("/terms")}>Kullanım koşulları</Text>
            <Text style={{ color: colors.primary }} onPress={() => router.push("/privacy")}>Gizlilik politikası</Text>
          </View>
        </>
      ) : null}

      {testMode ? (
        <Card style={{ marginTop: 16, borderStyle: "dashed" }}>
          <Text style={{ fontWeight: "700", color: colors.text }}>Test sürümü (yalnızca deneme)</Text>
          <Muted style={{ marginVertical: 6 }}>Ödeme sistemi bağlanana kadar Premium özelliklerini denemek için.</Muted>
          <Button title={premium ? "Premium'u kapat" : "Premium'u aç (deneme)"} kind="secondary" onPress={() => devToggle(!premium)} />
        </Card>
      ) : null}
      <ErrorText error={error} />
    </Screen>
  );
}

const fetchDev = (on: boolean) => api.devPremium(on);
