import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { AppSettings, SavedModelConfig, SourceLanguage, TargetLanguage, TranslationProvider } from "../electron/main/types";

type UiStatus =
  | "idle"
  | "selecting"
  | "capturing"
  | "translating"
  | "monitoring"
  | "failed"
  | "missing-key"
  | "no-text";

const text = {
  appName: "\u5c4f\u5e55\u7ffb\u8bd1",
  appSub: "Auto Detect \u2192 \u7b80\u4f53\u4e2d\u6587",
  screenshot: "\u622a\u56fe\u7ffb\u8bd1",
  chooseRealtime: "\u9009\u62e9\u5b9e\u65f6\u533a\u57df",
  stopRealtime: "\u505c\u6b62\u5b9e\u65f6\u7ffb\u8bd1",
  settings: "\u8bbe\u7f6e",
  minimize: "\u6700\u5c0f\u5316",
  close: "\u5173\u95ed",
  noOcr: "\u5c1a\u672a\u8bc6\u522b\u5230\u5c4f\u5e55\u6587\u5b57",
  source: "\u67e5\u770b\u8bc6\u522b\u539f\u6587",
  hideSource: "\u6536\u8d77\u8bc6\u522b\u539f\u6587",
  selectingTip: "\u62d6\u62fd\u9009\u62e9\u533a\u57df\uff0cEnter \u786e\u8ba4\uff0cEsc \u53d6\u6d88\u3002",
  resultShown: "\u7ffb\u8bd1\u7ed3\u679c\u5df2\u5728\u72ec\u7acb\u7a97\u53e3\u663e\u793a",
  resultWaiting: "\u5c31\u7eea\uff1a\u6309 F2 \u622a\u56fe\uff0c\u6216\u9009\u62e9\u5b9e\u65f6\u533a\u57df\u3002",
  refresh: "\u5237\u65b0",
  shortcutPrefix: "\u5feb\u6377\u952e",
  modelPrefix: "\u6a21\u578b",
  realtimeLine: "\u5b9e\u65f6\u7ffb\u8bd1\u4e2d",
  sourceAuto: "\u81ea\u52a8\u8bc6\u522b",
  english: "\u82f1\u8bed",
  japanese: "\u65e5\u8bed",
  korean: "\u97e9\u8bed",
  traditionalChinese: "\u4e2d\u6587\u7e41\u4f53",
  french: "\u6cd5\u8bed",
  german: "\u5fb7\u8bed",
  spanish: "\u897f\u73ed\u7259\u8bed",
  russian: "\u4fc4\u8bed",
  simplifiedChinese: "\u7b80\u4f53\u4e2d\u6587",
  provider: "\u63d0\u4f9b\u5546",
  siliconflow: "\u7845\u57fa\u6d41\u52a8",
  custom: "\u81ea\u5b9a\u4e49",
  sourceLanguage: "\u6e90\u8bed\u8a00",
  target: "\u76ee\u6807\u8bed\u8a00",
  model: "\u7ffb\u8bd1\u6a21\u578b",
  shortcut: "\u5feb\u6377\u952e",
  ocr: "OCR \u5f15\u64ce",
  ocrAuto: "\u81ea\u52a8\u4f18\u5148 Windows OCR",
  ocrWindows: "\u4ec5 Windows OCR",
  ocrTesseract: "\u4ec5 Tesseract",
  interval: "\u5b9e\u65f6\u5237\u65b0\u95f4\u9694(ms)",
  opacity: "\u900f\u660e\u5ea6",
  closeBehavior: "\u5173\u95ed\u7a97\u53e3\u65f6",
  minimizeToTray: "\u6700\u5c0f\u5316\u5230\u6258\u76d8",
  exitApp: "\u76f4\u63a5\u9000\u51fa\u8f6f\u4ef6",
  theme: "\u4e3b\u9898",
  dark: "\u6df1\u8272",
  light: "\u6d45\u8272",
  saving: "\u4fdd\u5b58\u4e2d...",
  save: "\u4fdd\u5b58",
  cancel: "\u53d6\u6d88",
  saveFailed: "\u4fdd\u5b58\u8bbe\u7f6e\u5931\u8d25",
  savedModels: "\u5df2\u4fdd\u5b58\u6a21\u578b",
  selectModel: "\u9009\u62e9\u6a21\u578b\u914d\u7f6e",
  saveModel: "\u4fdd\u5b58\u5f53\u524d\u914d\u7f6e",
  deleteModel: "\u5220\u9664",
  modelName: "\u914d\u7f6e\u540d\u79f0",
  newConfig: "\u65b0\u5efa\u914d\u7f6e",
  apiNote: "\u63a5\u53e3\u9700\u8981\u517c\u5bb9 OpenAI Chat Completions",
  idle: "\u5f85\u547d",
  selecting: "\u9009\u62e9\u533a\u57df\u4e2d",
  capturing: "\u8bc6\u522b\u4e2d",
  translating: "\u7ffb\u8bd1\u4e2d",
  monitoring: "\u5b9e\u65f6\u4e2d",
  failed: "\u5931\u8d25",
  missingKey: "\u672a\u8bbe\u7f6e Key",
  noText: "\u672a\u8bc6\u522b\u5230\u6587\u5b57"
};

const defaultSettings: AppSettings = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com/chat/completions",
  model: "deepseek-v4-flash",
  provider: "deepseek",
  sourceLanguage: "auto",
  targetLanguage: text.simplifiedChinese,
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

export function App() {
  return <AppShell />;
}

function AppShell() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [status, setStatus] = useState<UiStatus>("idle");
  const [sourceText, setSourceText] = useState("");
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [hasExternalResult, setHasExternalResult] = useState(false);

  useEffect(() => {
    void window.translatorApi.getSettings().then((loaded) => {
      setSettings(loaded);
      setRealtimeActive(loaded.realtimeEnabled);
    });

    window.translatorApi.onStatus((nextStatus) => {
      setStatus(mapRuntimeStatus(nextStatus));
      if (nextStatus !== "idle") setError("");
    });
    window.translatorApi.onOcrResult((nextText) => setSourceText(nextText));
    window.translatorApi.onComplete((payload) => {
      setSourceText(payload.sourceText);
      setHasExternalResult(true);
      setError("");
    });
    window.translatorApi.onError((message) => {
      setError(message);
      setStatus(message.includes("\u672a\u8bc6\u522b") ? "no-text" : "failed");
    });
    window.translatorApi.onRealtimeState((active) => {
      setRealtimeActive(active);
      setStatus(active ? "monitoring" : "idle");
    });
  }, []);

  async function saveCurrentSettings() {
    setSaving(true);
    try {
      const next = await window.translatorApi.saveSettings({
        ...settings,
        realtimeEnabled: realtimeActive
      });
      setSettings(next);
      await window.translatorApi.setOpacity(next.opacity);
      setSettingsOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.saveFailed);
      setStatus("failed");
    } finally {
      setSaving(false);
    }
  }

  async function startScreenshot() {
    setStatus("selecting");
    setError("");
    await window.translatorApi.startSelection("single");
  }

  async function toggleRealtime() {
    setError("");
    if (realtimeActive) {
      await window.translatorApi.stopRealtime();
      return;
    }
    setStatus("selecting");
    await window.translatorApi.startSelection("monitor");
  }

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

  function updateTargetLanguage(targetLanguageCode: TargetLanguage) {
    const targetLabels: Record<TargetLanguage, string> = {
      "zh-CN": text.simplifiedChinese,
      "zh-TW": text.traditionalChinese,
      en: text.english,
      ja: text.japanese,
      ko: text.korean
    };

    setSettings({
      ...settings,
      targetLanguageCode,
      targetLanguage: targetLabels[targetLanguageCode]
    });
  }

  function selectSavedModel(id: string) {
    const model = settings.savedModels.find((m) => m.id === id);
    if (!model) return;
    setSettings({
      ...settings,
      provider: model.provider,
      baseUrl: model.baseUrl,
      model: model.model,
      apiKey: model.apiKey
    });
  }

  function saveCurrentAsModelConfig(name: string) {
    if (!name.trim()) return;
    const id = `custom-${Date.now()}`;
    const newConfig: SavedModelConfig = {
      id,
      name: name.trim(),
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      model: settings.model,
      apiKey: settings.apiKey
    };
    setSettings({
      ...settings,
      savedModels: [...settings.savedModels, newConfig]
    });
    return id;
  }

  function deleteSavedModel(id: string) {
    setSettings({
      ...settings,
      savedModels: settings.savedModels.filter((m) => m.id !== id)
    });
  }

  const currentStatus: UiStatus = !settings.apiKey ? "missing-key" : status;
  const languageRoute = `${sourceLabel(settings.sourceLanguage)} \u2192 ${targetLabel(settings.targetLanguageCode)}`;

  return (
    <div className={`app-shell compact-shell theme-${settings.theme}`}>
      <section className={realtimeActive ? "compact-panel is-monitoring" : "compact-panel"}>
        <TitleBar
          status={currentStatus}
          languageRoute={languageRoute}
          onSettings={() => setSettingsOpen(true)}
          onMinimize={() => void window.translatorApi.minimizeWindow()}
          onClose={() => void window.translatorApi.closeWindow()}
        />

        <main className="compact-main">
          <ActionButtons
            shortcut={settings.shortcut}
            realtimeActive={realtimeActive}
            onScreenshot={() => void startScreenshot()}
            onRealtime={() => void toggleRealtime()}
          />

          <CompactInfoBar
            status={currentStatus}
            model={settings.model}
            shortcut={settings.shortcut}
            refreshIntervalMs={settings.refreshIntervalMs}
            realtimeActive={realtimeActive}
          />

          {status === "selecting" ? <div className="selecting-hint">{text.selectingTip}</div> : null}
          {error ? <div className="compact-error">{error}</div> : null}

          <EmptyStateCard missingKey={!settings.apiKey} hasResult={hasExternalResult} onSettings={() => setSettingsOpen(true)} />

          <SourceTextPanel
            open={sourceOpen}
            sourceText={sourceText}
            languageRoute={languageRoute}
            onToggle={() => setSourceOpen((open) => !open)}
          />
        </main>
      </section>

      {settingsOpen ? (
        <SettingsDialog
          settings={settings}
          saving={saving}
          onChange={setSettings}
          onApplyProvider={applyProviderTemplate}
          onTargetChange={updateTargetLanguage}
          onSelectSavedModel={selectSavedModel}
          onSaveModelConfig={saveCurrentAsModelConfig}
          onDeleteSavedModel={deleteSavedModel}
          onClose={() => setSettingsOpen(false)}
          onSave={() => void saveCurrentSettings()}
        />
      ) : null}
    </div>
  );
}

function TitleBar({
  status,
  languageRoute,
  onSettings,
  onMinimize,
  onClose
}: {
  status: UiStatus;
  languageRoute: string;
  onSettings: () => void;
  onMinimize: () => void;
  onClose: () => void;
}) {
  return (
    <header className="compact-titlebar window-drag-layer">
      <div className="compact-brand">
        <span className="app-glyph">{"\u6587A"}</span>
        <div>
          <strong>{text.appName}</strong>
          <span>{languageRoute || text.appSub}</span>
        </div>
      </div>
      <StatusBadge status={status} />
      <div className="compact-window-actions">
        <SettingsButton onClick={onSettings} />
        <IconButton label={text.minimize} onClick={onMinimize}>
          -
        </IconButton>
        <IconButton label={text.close} onClick={onClose} danger>
          x
        </IconButton>
      </div>
    </header>
  );
}

function StatusBadge({ status }: { status: UiStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      {statusLabel(status)}
    </span>
  );
}

function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton label={text.settings} onClick={onClick}>
      {"\u2699"}
    </IconButton>
  );
}

function ActionButtons({
  shortcut,
  realtimeActive,
  onScreenshot,
  onRealtime
}: {
  shortcut: string;
  realtimeActive: boolean;
  onScreenshot: () => void;
  onRealtime: () => void;
}) {
  return (
    <section className="action-buttons">
      <button className="action-primary" onClick={onScreenshot}>
        <span className="button-icon">{"\u25a2"}</span>
        <span>{text.screenshot}</span>
        <kbd>{shortcut || "F2"}</kbd>
      </button>
      <button className={realtimeActive ? "action-secondary is-live" : "action-secondary"} onClick={onRealtime}>
        <span>{realtimeActive ? text.stopRealtime : text.chooseRealtime}</span>
      </button>
    </section>
  );
}

function CompactInfoBar({
  status,
  model,
  shortcut,
  refreshIntervalMs,
  realtimeActive
}: {
  status: UiStatus;
  model: string;
  shortcut: string;
  refreshIntervalMs: number;
  realtimeActive: boolean;
}) {
  return (
    <section className="compact-info-bar">
      <span className={realtimeActive ? "info-live" : ""}>
        {realtimeActive ? text.realtimeLine : statusLabel(status)}
        {" \u00b7 "}
        {text.refresh} {(refreshIntervalMs / 1000).toFixed(1)}s
      </span>
      <span>{text.modelPrefix}: {model}</span>
      <span>{text.shortcutPrefix}: {shortcut}</span>
    </section>
  );
}

function EmptyStateCard({
  missingKey,
  hasResult,
  onSettings
}: {
  missingKey: boolean;
  hasResult: boolean;
  onSettings: () => void;
}) {
  if (missingKey) {
    return (
      <section className="empty-state-card has-warning">
        <span>{text.missingKey}</span>
        <button onClick={onSettings}>{text.settings}</button>
      </section>
    );
  }

  return (
    <section className="empty-state-card">
      <span>{hasResult ? text.resultShown : text.resultWaiting}</span>
    </section>
  );
}

function SourceTextPanel({
  open,
  sourceText,
  languageRoute,
  onToggle
}: {
  open: boolean;
  sourceText: string;
  languageRoute: string;
  onToggle: () => void;
}) {
  return (
    <section className="source-panel">
      <button className="source-toggle" onClick={onToggle}>
        <span>{open ? text.hideSource : text.source}</span>
        <small>{languageRoute}</small>
      </button>
      {open ? <div className="source-content">{sourceText || text.noOcr}</div> : null}
    </section>
  );
}

function SettingsDialog({
  settings,
  saving,
  onChange,
  onApplyProvider,
  onTargetChange,
  onSelectSavedModel,
  onSaveModelConfig,
  onDeleteSavedModel,
  onClose,
  onSave
}: {
  settings: AppSettings;
  saving: boolean;
  onChange: (settings: AppSettings) => void;
  onApplyProvider: (provider: TranslationProvider) => void;
  onTargetChange: (target: TargetLanguage) => void;
  onSelectSavedModel: (id: string) => void;
  onSaveModelConfig: (name: string) => string | undefined;
  onDeleteSavedModel: (id: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const [newModelName, setNewModelName] = useState("");
  return (
    <div className="settings-backdrop">
      <aside className="settings-drawer">
        <nav className="settings-rail">
          <strong>{text.settings}</strong>
          <span className="rail-item active">API</span>
          <span className="rail-item">{text.target}</span>
          <span className="rail-item">OCR</span>
          <span className="rail-item">{text.shortcut}</span>
        </nav>

        <section className="settings-content">
          <header>
            <strong>API {"\u8bbe\u7f6e"}</strong>
            <IconButton label={text.close} onClick={onClose}>
              x
            </IconButton>
          </header>

          <div className="settings-grid">
            <Field label={text.savedModels}>
              <div className="saved-models-row">
                <select
                  value=""
                  onChange={(event) => {
                    if (event.target.value) onSelectSavedModel(event.target.value);
                  }}
                >
                  <option value="">{text.selectModel}</option>
                  {settings.savedModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </Field>
            <Field label={text.provider}>
              <select value={settings.provider} onChange={(event) => onApplyProvider(event.target.value as TranslationProvider)}>
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
                <option value="siliconflow">{text.siliconflow}</option>
                <option value="custom">{text.custom}</option>
              </select>
            </Field>
            <Field label="API Key">
              <input type="password" value={settings.apiKey} onChange={(event) => onChange({ ...settings, apiKey: event.target.value })} placeholder="sk-..." />
            </Field>
            <Field label="Base URL">
              <input type="text" value={settings.baseUrl} onChange={(event) => onChange({ ...settings, baseUrl: event.target.value })} />
            </Field>
            <Field label={text.model}>
              <input type="text" value={settings.model} onChange={(event) => onChange({ ...settings, model: event.target.value })} />
            </Field>
            <Field label={text.saveModel}>
              <div className="save-model-row">
                <input
                  type="text"
                  value={newModelName}
                  onChange={(event) => setNewModelName(event.target.value)}
                  placeholder={text.modelName}
                />
                <button
                  className="save-model-btn"
                  onClick={() => {
                    const id = onSaveModelConfig(newModelName);
                    if (id) setNewModelName("");
                  }}
                  disabled={!newModelName.trim()}
                >
                  {text.saveModel}
                </button>
              </div>
            </Field>
            {settings.savedModels.filter((m) => m.id.startsWith("custom-")).length > 0 && (
              <Field label={text.deleteModel}>
                <div className="delete-model-list">
                  {settings.savedModels
                    .filter((m) => m.id.startsWith("custom-"))
                    .map((m) => (
                      <span key={m.id} className="delete-model-item">
                        {m.name}
                        <button onClick={() => onDeleteSavedModel(m.id)}>x</button>
                      </span>
                    ))}
                </div>
              </Field>
            )}
            <Field label="TLS 验证">
              <select value={settings.tlsVerify ? "true" : "false"} onChange={(event) => onChange({ ...settings, tlsVerify: event.target.value === "true" })}>
                <option value="true">启用（推荐）</option>
                <option value="false">禁用（自签名证书）</option>
              </select>
            </Field>
            <Field label={text.sourceLanguage}>
              <select value={settings.sourceLanguage} onChange={(event) => onChange({ ...settings, sourceLanguage: event.target.value as SourceLanguage })}>
                <option value="auto">{text.sourceAuto}</option>
                <option value="en">{text.english}</option>
                <option value="ja">{text.japanese}</option>
                <option value="ko">{text.korean}</option>
                <option value="zh-TW">{text.traditionalChinese}</option>
                <option value="fr">{text.french}</option>
                <option value="de">{text.german}</option>
                <option value="es">{text.spanish}</option>
                <option value="ru">{text.russian}</option>
              </select>
            </Field>
            <Field label={text.target}>
              <select value={settings.targetLanguageCode} onChange={(event) => onTargetChange(event.target.value as TargetLanguage)}>
                <option value="zh-CN">{text.simplifiedChinese}</option>
                <option value="zh-TW">{text.traditionalChinese}</option>
                <option value="en">{text.english}</option>
                <option value="ja">{text.japanese}</option>
                <option value="ko">{text.korean}</option>
              </select>
            </Field>
            <Field label={text.shortcut}>
              <input value={settings.shortcut} onChange={(event) => onChange({ ...settings, shortcut: event.target.value || "F2" })} />
            </Field>
            <Field label={text.ocr}>
              <select value={settings.ocrEngine} onChange={(event) => onChange({ ...settings, ocrEngine: event.target.value as AppSettings["ocrEngine"] })}>
                <option value="auto">{text.ocrAuto}</option>
                <option value="windows">{text.ocrWindows}</option>
                <option value="tesseract">{text.ocrTesseract}</option>
              </select>
            </Field>
            <Field label={text.interval}>
              <input type="number" min={800} max={5000} step={100} value={settings.refreshIntervalMs} onChange={(event) => onChange({ ...settings, refreshIntervalMs: Number(event.target.value) })} />
            </Field>
            <Field label={text.opacity}>
              <input type="range" min={0.85} max={1} step={0.01} value={settings.opacity} onChange={(event) => onChange({ ...settings, opacity: Number(event.target.value) })} />
            </Field>
            <Field label={text.closeBehavior}>
              <select value={settings.closeBehavior} onChange={(event) => onChange({ ...settings, closeBehavior: event.target.value as AppSettings["closeBehavior"] })}>
                <option value="minimize-to-tray">{text.minimizeToTray}</option>
                <option value="exit">{text.exitApp}</option>
              </select>
            </Field>
            <Field label={text.theme}>
              <select value={settings.theme} onChange={(event) => onChange({ ...settings, theme: event.target.value as AppSettings["theme"] })}>
                <option value="dark">{text.dark}</option>
                <option value="light">{text.light}</option>
              </select>
            </Field>
          </div>

          <footer>
            <span>{text.apiNote}</span>
            <div>
              <button className="drawer-cancel" onClick={onClose}>{text.cancel}</button>
              <button className="drawer-save" onClick={onSave} disabled={saving}>{saving ? text.saving : text.save}</button>
            </div>
          </footer>
        </section>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function IconButton({
  label,
  children,
  danger,
  onClick
}: {
  label: string;
  children: ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={danger ? "icon-button danger" : "icon-button"} title={label} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

function mapRuntimeStatus(status: string): UiStatus {
  if (status === "capturing") return "capturing";
  if (status === "translating") return "translating";
  if (status === "monitoring") return "monitoring";
  return "idle";
}

function statusLabel(status: UiStatus) {
  if (status === "selecting") return text.selecting;
  if (status === "capturing") return text.capturing;
  if (status === "translating") return text.translating;
  if (status === "monitoring") return text.monitoring;
  if (status === "failed") return text.failed;
  if (status === "missing-key") return text.missingKey;
  if (status === "no-text") return text.noText;
  return text.idle;
}

function sourceLabel(source: SourceLanguage) {
  const labels: Record<SourceLanguage, string> = {
    auto: text.sourceAuto,
    en: text.english,
    ja: text.japanese,
    ko: text.korean,
    "zh-TW": text.traditionalChinese,
    fr: text.french,
    de: text.german,
    es: text.spanish,
    ru: text.russian
  };
  return labels[source];
}

function targetLabel(target: TargetLanguage) {
  const labels: Record<TargetLanguage, string> = {
    "zh-CN": text.simplifiedChinese,
    "zh-TW": text.traditionalChinese,
    en: text.english,
    ja: text.japanese,
    ko: text.korean
  };
  return labels[target];
}
