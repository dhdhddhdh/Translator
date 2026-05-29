import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { AppSettings, SavedModelConfig } from "./types";

type StoredSettings = Omit<AppSettings, "apiKey" | "savedModels"> & {
  encryptedApiKey: string;
  savedModels: SavedModelConfig[];
};

const defaultSavedModels: SavedModelConfig[] = [
  {
    id: "builtin-deepseek",
    name: "DeepSeek",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com/chat/completions",
    model: "deepseek-v4-flash"
  },
  {
    id: "builtin-openai",
    name: "OpenAI",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4.1-mini"
  },
  {
    id: "builtin-openrouter",
    name: "OpenRouter",
    provider: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    model: "openai/gpt-4.1-mini"
  },
  {
    id: "builtin-siliconflow",
    name: "SiliconFlow",
    provider: "siliconflow",
    baseUrl: "https://api.siliconflow.cn/v1/chat/completions",
    model: "Qwen/Qwen2.5-7B-Instruct"
  }
];

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
  theme: "dark",
  tlsVerify: true,
  savedModels: defaultSavedModels
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

function normalizeSavedModels(stored: Array<Partial<SavedModelConfig>>): SavedModelConfig[] {
  const normalized = stored
    .map((model, index) => ({
      id: model.id || `model-${index}`,
      name: model.name || "",
      provider: model.provider,
      baseUrl: model.baseUrl || "",
      model: model.model || ""
    }))
    .filter((model): model is SavedModelConfig =>
      Boolean(model.name && model.provider && model.baseUrl && model.model)
    );

  const seen = new Set<string>();
  return [...defaultSavedModels, ...normalized].filter((model) => {
    if (seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });
}

export function loadSettings(): AppSettings {
  const filePath = getSettingsPath();
  if (!fs.existsSync(filePath)) {
    return defaultSettings;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    const savedModels = parsed.savedModels
      ? normalizeSavedModels(parsed.savedModels)
      : defaultSavedModels;

    const settings: AppSettings = {
      ...defaultSettings,
      ...parsed,
      apiKey: decrypt(parsed.encryptedApiKey ?? ""),
      savedModels
    };

    if (/\\u[0-9a-fA-F]{4}/.test(settings.targetLanguage)) {
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
  const { apiKey, savedModels, ...settingsWithoutSecrets } = nextSettings;

  const payload: StoredSettings = {
    ...settingsWithoutSecrets,
    encryptedApiKey: encrypt(apiKey),
    savedModels: normalizeSavedModels(savedModels)
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  return {
    ...nextSettings,
    savedModels: payload.savedModels
  };
}
