import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { DAY_LABELS, DISCLAIMER_DIET, dayTotal, MEAL_SLOT_LABELS, MEAL_SLOTS } from "@menu/shared";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useLoad } from "../../lib/useLoad";
import { Button, Card, Chip, colors, Loading, Muted, s, Screen } from "../../components/ui";
import { MacroLine, NutritionBars } from "../../components/NutritionBars";
import { PremiumLock } from "../../components/PremiumLock";
import { Tracker } from "../../components/Tracker";

const todayIndex = () => ((new Date().getDay() + 6) % 7) + 1;

export default function NutritionScreen() {
  const { me } = useAuth();
  const { data: plan, loading } = useLoad(api.currentPlan);
  const [day, setDay] = useState(todayIndex());
  const t = me?.targets;

  if (!me) return <Loading />;
  if (!me.premium) {
    return (
      <Screen>
        <PremiumLock title="Kalori ve beslenme takibi Premium'a özel" text="Her günün kalorisini, protein, karbonhidrat ve yağ miktarını, lif, demir, kalsiyum ve vitaminler gibi mikro besinleri hedefinizle karşılaştırın." />
      </Screen>
    );
  }
  if (loading && plan === undefined) return <Loading />;
  const d = plan?.days.find((x) => x.day === day);
  const { total, missing } = d ? dayTotal(MEAL_SLOTS.map((sl) => d[sl])) : { total: null, missing: 0 };

  return (
    <Screen>
      <Tracker targets={t ?? null} plan={plan} />
      <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, marginTop: 8, marginBottom: 8 }}>Menü analizi</Text>
      {!t ? (
        <Card>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Diyet programı kapalı</Text>
          <Muted style={{ marginVertical: 6 }}>Boy, kilo ve hedefinizi girin; günlük kalori, makro ve mikro besin hedeflerinizi hesaplayalım.</Muted>
          <Button title="Diyet programını başlat" onPress={() => router.push("/body")} />
        </Card>
      ) : (
        <Card>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Günlük hedefiniz: {t.kcal} kcal</Text>
          <Muted>Protein {t.protein_g} g · Karbonhidrat {t.karb_g} g · Yağ {t.yag_g} g · BKİ {String(t.bmi).replace(".", ",")}</Muted>
          <Button title="Bilgilerimi düzenle" kind="secondary" onPress={() => router.push("/body")} />
        </Card>
      )}

      {!plan ? (
        <Muted>Günlük besin değerlerini görmek için önce haftalık menü oluşturun.</Muted>
      ) : (
        <>
          <View style={[s.wrap, { marginBottom: 4 }]}>
            {plan.days.map((x) => <Chip key={x.day} label={DAY_LABELS[x.day - 1].slice(0, 3)} selected={day === x.day} onPress={() => setDay(x.day)} />)}
          </View>
          {d && total ? (
            <>
              <Card>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 10 }}>{DAY_LABELS[day - 1]} (kişi başı)</Text>
                <NutritionBars n={total} targets={t} />
                {missing ? <Muted style={{ fontSize: 12 }}>{missing} öğünün besin bilgisi yok, toplama dahil değil.</Muted> : null}
              </Card>
              <Card>
                {MEAL_SLOTS.map((sl) => (
                  <View key={sl} style={{ paddingVertical: 6 }}>
                    <Muted style={{ fontSize: 12 }}>{MEAL_SLOT_LABELS[sl]}</Muted>
                    <Text style={{ color: colors.text, fontSize: 15 }} onPress={() => router.push(`/recipe/${d[sl].id}`)}>{d[sl].name_tr}</Text>
                    {d[sl].nutrition ? <MacroLine n={d[sl].nutrition!} /> : null}
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}
      <Muted style={{ fontSize: 12, marginTop: 8 }}>{DISCLAIMER_DIET}</Muted>
    </Screen>
  );
}
