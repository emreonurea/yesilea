// Expo, npm workspaces (monorepo) yapısını otomatik tanır; @menu/shared paketi buradan derlenir.
const { getDefaultConfig } = require("expo/metro-config");
module.exports = getDefaultConfig(__dirname);
