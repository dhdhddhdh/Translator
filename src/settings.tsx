import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import type { AppSettings, SavedModelConfig, TranslationProvider } from "../electron/main/types";
import "./styles.css";

const text = {
  title: "API 设置",
  close: "关闭",
  savedModels: "已保存模型",
  selectModel: "选择模型配置",
  modelPresetNote: "模型预设只保存 Base URL 和模型，不保存 API Key",
  provider: "提供商",
  siliconflow: "硅基流动",
  custom: "自定义",
  accountKey: "账号 API Key",
  model: "翻译模型",
  shortcut: "快捷键",
  saveModel: "保存当前配置",
  modelName: "配置名称",
  deleteModel: "删除",
  tlsVerify: "TLS 证书验证",
  tlsEnabled: "启用（推荐）",
  tlsDisabled: "禁用（仅自签名证书）",
  interval: "实时刷新间隔(ms)",
  opacity: "透明度",
  closeBehavior: "关闭窗口时",
  minimizeToTray: "最小化到托盘",
  exitApp: "直接退出软件",
  theme: "主题",
  dark: "深色",
  light: "浅色",
  apiNote: "接口需要兼容 OpenAI Chat Completions",
  cancel: "取消",
  save: "保存",
  saving: "保存中...",
  saved: "设置已保存",
  saveFailed: "保存设置失败"
};

const defaultSettings: AppSettings = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com/chat/completions",
  model: "deepseek-v4-flash",
  provider: "deepseek",
  sourceLanguage: "auto",
  targetLanguage: "简体中文",
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
  savedModels: []
};

function SettingsApp() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [snackbar, setSnackbar] = useState("");

  useEffect(() => {
    void window.translatorApi.getSettings().then(setSettings);
  }, []);

  function applyProviderTemplate(provider: TranslationProvider) {
    const templates: Record<TranslationProvider, { baseUrl: string; model: string }> = {
      deepseek: {
        baseUrl: "https://api.deepseek.com/chat/completions",
        model: "deepseek-v4-flash"
      },
      openai: {
        baseUrl: "https://api.openai.com/v1/chat/completions",
        model: "gpt-4.1-mini"
      },
      openrouter: {
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        model: "openai/gpt-4.1-mini"
      },
      siliconflow: {
        baseUrl: "https://api.siliconflow.cn/v1/chat/completions",
        model: "Qwen/Qwen2.5-7B-Instruct"
      },
      custom: {
        baseUrl: settings.baseUrl,
        model: settings.model
      }
    };

    setSettings((current) => ({
      ...current,
      provider,
      baseUrl: provider === "custom" ? current.baseUrl : templates[provider].baseUrl,
      model: provider === "custom" ? current.model : templates[provider].model
    }));
  }

  function selectSavedModel(id: string) {
    const model = settings.savedModels.find((item) => item.id === id);
    if (!model) return;
    setSettings({
      ...settings,
      provider: model.provider,
      baseUrl: model.baseUrl,
      model: model.model
    });
  }

  async function saveCurrentAsModelConfig() {
    if (!newModelName.trim()) return;
    const newConfig: SavedModelConfig = {
      id: `custom-${Date.now()}`,
      name: newModelName.trim(),
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      model: settings.model
    };
    const saved = await window.translatorApi.saveSettings({
      ...settings,
      savedModels: [...settings.savedModels, newConfig]
    });
    setSettings(saved);
    setNewModelName("");
    showSnackbar(text.saved);
  }

  function deleteSavedModel(id: string) {
    setSettings({
      ...settings,
      savedModels: settings.savedModels.filter((item) => item.id !== id)
    });
  }

  async function save() {
    setSaving(true);
    try {
      const saved = await window.translatorApi.saveSettings(settings);
      setSettings(saved);
      await window.translatorApi.setOpacity(saved.opacity);
      showSnackbar(text.saved);
    } catch (error) {
      showSnackbar(error instanceof Error ? error.message : text.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  function showSnackbar(message: string) {
    setSnackbar(message);
    window.setTimeout(() => setSnackbar(""), 1500);
  }

  return (
    <div className="settings-page-shell">
      <aside className="settings-drawer settings-window-panel">
        <nav className="settings-rail">
          <strong>设置</strong>
          <span className="rail-item active">API</span>
        </nav>

        <section className="settings-content">
          <header>
            <strong>{text.title}</strong>
            <div className="settings-header-actions">
              <button className="icon-button" title="最小化" aria-label="最小化" onClick={() => void window.translatorApi.minimizeSettingsWindow()}>
                -
              </button>
              <button className="icon-button" title={text.close} aria-label={text.close} onClick={() => void window.translatorApi.closeSettingsWindow()}>
                x
              </button>
            </div>
          </header>

          <div className="settings-grid">
            <Field label={text.savedModels} hint={text.modelPresetNote}>
              <select value="" onChange={(event) => event.target.value && selectSavedModel(event.target.value)}>
                <option value="">{text.selectModel}</option>
                {settings.savedModels.map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </Field>
            <Field label={text.provider}>
              <select value={settings.provider} onChange={(event) => applyProviderTemplate(event.target.value as TranslationProvider)}>
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
                <option value="siliconflow">{text.siliconflow}</option>
                <option value="custom">{text.custom}</option>
              </select>
            </Field>
            <Field label={text.accountKey}>
              <input type="password" value={settings.apiKey} onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })} placeholder="sk-..." />
            </Field>
            <Field label="Base URL">
              <input type="text" value={settings.baseUrl} onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })} />
            </Field>
            <Field label={text.model}>
              <input type="text" value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })} />
            </Field>
            <Field label={text.shortcut}>
              <input value={settings.shortcut} onChange={(event) => setSettings({ ...settings, shortcut: event.target.value || "F2" })} placeholder="F2" />
            </Field>
            <Field label={text.saveModel}>
              <div className="save-model-row">
                <input value={newModelName} onChange={(event) => setNewModelName(event.target.value)} placeholder={text.modelName} />
                <button className="save-model-btn" onClick={() => void saveCurrentAsModelConfig()} disabled={!newModelName.trim()}>
                  {text.saveModel}
                </button>
              </div>
            </Field>
            {settings.savedModels.filter((model) => model.id.startsWith("custom-")).length > 0 ? (
              <Field label={text.deleteModel}>
                <div className="delete-model-list">
                  {settings.savedModels
                    .filter((model) => model.id.startsWith("custom-"))
                    .map((model) => (
                      <span key={model.id} className="delete-model-item">
                        {model.name}
                        <button onClick={() => deleteSavedModel(model.id)}>x</button>
                      </span>
                    ))}
                </div>
              </Field>
            ) : null}
            <Field label={text.tlsVerify}>
              <select value={settings.tlsVerify ? "true" : "false"} onChange={(event) => setSettings({ ...settings, tlsVerify: event.target.value === "true" })}>
                <option value="true">{text.tlsEnabled}</option>
                <option value="false">{text.tlsDisabled}</option>
              </select>
            </Field>
            <Field label={text.interval}>
              <input type="number" min={800} max={5000} step={100} value={settings.refreshIntervalMs} onChange={(event) => setSettings({ ...settings, refreshIntervalMs: Number(event.target.value) })} />
            </Field>
            <Field label={text.opacity}>
              <input type="range" min={0.85} max={1} step={0.01} value={settings.opacity} onChange={(event) => setSettings({ ...settings, opacity: Number(event.target.value) })} />
            </Field>
            <Field label={text.closeBehavior}>
              <select value={settings.closeBehavior} onChange={(event) => setSettings({ ...settings, closeBehavior: event.target.value as AppSettings["closeBehavior"] })}>
                <option value="minimize-to-tray">{text.minimizeToTray}</option>
                <option value="exit">{text.exitApp}</option>
              </select>
            </Field>
            <Field label={text.theme}>
              <select value={settings.theme} onChange={(event) => setSettings({ ...settings, theme: event.target.value as AppSettings["theme"] })}>
                <option value="dark">{text.dark}</option>
                <option value="light">{text.light}</option>
              </select>
            </Field>
          </div>

          <footer>
            <span>{text.apiNote}</span>
            <div>
              <button className="drawer-cancel" onClick={() => void window.translatorApi.closeSettingsWindow()}>{text.cancel}</button>
              <button className="drawer-save" onClick={() => void save()} disabled={saving}>{saving ? text.saving : text.save}</button>
            </div>
          </footer>
        </section>
      </aside>
      {snackbar ? <div className="snackbar">{snackbar}</div> : null}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

createRoot(document.getElementById("settings-root")!).render(<SettingsApp />);
