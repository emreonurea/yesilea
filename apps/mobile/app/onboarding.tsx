import { router } from "expo-router";
import { DEFAULT_PROFILE } from "@menu/shared";
import { useAuth } from "../lib/auth";
import { ProfileForm } from "../components/ProfileForm";
import { Muted, Screen, Title } from "../components/ui";

export default function Onboarding() {
  const { refresh } = useAuth();
  return (
    <Screen>
      <Title>Sizi tanıyalım</Title>
      <Muted style={{ marginBottom: 16 }}>Menüleri bu bilgilere göre hazırlıyoruz. İstediğiniz zaman Ayarlar'dan değiştirebilirsiniz.</Muted>
      <ProfileForm initial={DEFAULT_PROFILE} submitLabel="Başla" onSaved={async () => { await refresh(); router.replace("/"); }} />
    </Screen>
  );
}
