import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { AppSettings } from "./types";

type StoredSettings = Omit<AppSettings, "apiKey"> & {
  encryptedApiKey: string;
};

const defaultSettings: AppSettings = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com/chat/completions",
  model: "deepseek-v4-flash",
  provider: "deepseek",
  sourceLanguage: "auto",
  targetLanguage: "\u4e2d\u6587",
  targetLanguageCode: "zh-CN",
  closeBehavior: "exit",
  shortcut: "F2",
  ocrEngine: "auto",
  refreshIntervalMs: 1500,
  fontSize: 18,
  opacity: 1,
  realtimeEnabled: false,
  theme: "dark"
};

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function encrypt(text: string) {
  if (!text) return "";
  if (!safeStorage.isEncryptionAvailable()) return Buffer.from(text, "utf8").toString("base64");
  return safeStorage.encryptString(text).toString("base64");
}

function decrypt(value: string) {
  if (!value) return "";
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return Buffer.from(value, "base64").toString("utf8");
    }
    return safeStorage.decryptString(Buffer.from(value, "base64"));
  } catch {
    return "";
  }
}

export function loadSettings(): AppSettings {
  const filePath = getSettingsPath();
  if (!fs.existsSync(filePath)) {
    return defaultSettings;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    const settings = {
      ...defaultSettings,
      ...parsed,
      apiKey: decrypt(parsed.encryptedApiKey ?? "")
    };
    if (/[\u00c0-\u00ff]{2,}|\\u[0-9a-fA-F]{4}/.test(settings.targetLanguage)) {
      settings.targetLanguage = defaultSettings.targetLanguage;
    }
    if (settings.opacity < 0.85) {
      settings.opacity = defaultSettings.opacity;
    }
    return settings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(nextSettings: AppSettings): AppSettings {
  const filePath = getSettingsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const payload: StoredSettings = {
    ...nextSettings,
    encryptedApiKey: encrypt(nextSettings.apiKey)
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  return nextSettings;
}
