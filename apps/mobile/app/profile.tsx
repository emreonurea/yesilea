import { router } from "expo-router";
import { useAuth } from "../lib/auth";
import { ProfileForm } from "../components/ProfileForm";
import { Loading, Screen } from "../components/ui";

export default function EditProfile() {
  const { me, refresh } = useAuth();
  if (!me) return <Loading />;
  return (
    <Screen>
      <ProfileForm initial={me.profile} onSaved={async () => { await refresh(); router.back(); }} />
    </Screen>
  );
}
