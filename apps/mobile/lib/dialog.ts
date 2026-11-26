// Onay ve bilgi pencereleri: telefonda yerel pencere, web'de tarayıcının kendi penceresi.
// (react-native-web'de Alert.alert hiçbir şey göstermez.)

import { Alert, Platform } from "react-native";

export function confirmAction(title: string, message: string, okText: string, onOk: () => void, destructive = false) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: "Vazgeç", style: "cancel" },
    { text: okText, style: destructive ? "destructive" : "default", onPress: onOk },
  ]);
}

export function showInfo(title: string, message: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
