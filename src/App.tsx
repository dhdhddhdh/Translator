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
  appName: "\u55b5\u8bd1",
  appWindowTitle: "\u55b5\u8bd1 - Screen Translator",
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
  resultShown: "",
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
  modelPresetNote: "\u6a21\u578b\u9884\u8bbe\u53ea\u4fdd\u5b58 Base URL \u548c\u6a21\u578b\uff0c\u4e0d\u4fdd\u5b58 API Key",
  accountKey: "\u8d26\u53f7 API Key",
  deleteModel: "\u5220\u9664",
  modelName: "\u914d\u7f6e\u540d\u79f0",
  newConfig: "\u65b0\u5efa\u914d\u7f6e",
  savedToast: "\u8bbe\u7f6e\u5df2\u4fdd\u5b58",
  tlsVerify: "TLS \u8bc1\u4e66\u9a8c\u8bc1",
  tlsEnabled: "\u542f\u7528\uff08\u63a8\u8350\uff09",
  tlsDisabled: "\u7981\u7528\uff08\u4ec5\u81ea\u7b7e\u540d\u8bc1\u4e66\uff09",
  apiNote: "\u63a5\u53e3\u9700\u8981\u517c\u5bb9 OpenAI Chat Completions",
  idle: "\u5f85\u547d",
  selecting: "\u9009\u62e9\u533a\u57df\u4e2d",
  capturing: "\u8bc6\u522b\u4e2d",
  translating: "\u7ffb\u8bd1\u4e2d",
  monitoring: "\u7ffb\u8bd1\u4e2d",
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
  const [, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState("");
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
    window.translatorApi.onSettingsUpdated((nextSettings) => {
      setSettings(nextSettings);
      setRealtimeActive(nextSettings.realtimeEnabled);
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
      setSnackbar(text.savedToast);
      window.setTimeout(() => setSnackbar(""), 1600);
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
      model: model.model
    });
  }

  async function saveCurrentAsModelConfig(name: string) {
    if (!name.trim()) return false;
    const id = `custom-${Date.now()}`;
    const newConfig: SavedModelConfig = {
      id,
      name: name.trim(),
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      model: settings.model
    };
    const nextSettings = {
      ...settings,
      savedModels: [...settings.savedModels, newConfig]
    };

    try {
      const saved = await window.translatorApi.saveSettings(nextSettings);
      setSettings(saved);
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.saveFailed);
      setStatus("failed");
      return false;
    }
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
        <MaterialTitleBar
          status={currentStatus}
          languageRoute={languageRoute}
          onSettings={() => void window.translatorApi.openSettingsWindow()}
          onMinimize={() => void window.translatorApi.minimizeWindow()}
          onClose={() => void window.translatorApi.closeWindow()}
        />

        <main className="compact-main">
          <ToolSection
            title={`◉ 翻译模式: ${realtimeActive ? "实时监控" : "快速模式"}`}
            meta={`${statusLabel(currentStatus)}  ${text.refresh} ${(settings.refreshIntervalMs / 1000).toFixed(1)}s`}
          >
          <ActionButtons
            shortcut={settings.shortcut}
            realtimeActive={realtimeActive}
            onScreenshot={() => void startScreenshot()}
            onRealtime={() => void toggleRealtime()}
          />
          </ToolSection>

          <ToolSection title={"▣ 翻译引擎"} meta={settings.provider}>
          <CompactInfoBar
            status={currentStatus}
            model={settings.model}
            shortcut={settings.shortcut}
            refreshIntervalMs={settings.refreshIntervalMs}
            realtimeActive={realtimeActive}
          />
          </ToolSection>

          <ToolSection title={"■ 当前状态"} meta={languageRoute}>
            <div className="state-grid">
              <button className="state-tile" onClick={() => void window.translatorApi.openSettingsWindow()}>
                <span>⚙</span>
                <strong>API 设置</strong>
              </button>
              <button className="state-tile" onClick={() => void window.translatorApi.minimizeWindow()}>
                <span>◇</span>
                <strong>最小化</strong>
              </button>
              <button className="state-tile" onClick={() => void window.translatorApi.closeWindow()}>
                <span>↪</span>
                <strong>退出</strong>
              </button>
            </div>
          </ToolSection>

          {status === "selecting" ? <LoadingState>{text.selectingTip}</LoadingState> : null}
          {error ? <ErrorState>{error}</ErrorState> : null}

          <EmptyState missingKey={!settings.apiKey} hasResult={hasExternalResult} onSettings={() => void window.translatorApi.openSettingsWindow()} />
        </main>
      </section>
      {snackbar ? <Snackbar>{snackbar}</Snackbar> : null}
    </div>
  );
}

function ToolSection({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section className="tool-section">
      <header className="tool-section-title">
        <strong>{title}</strong>
        {meta ? <span>{meta}</span> : null}
      </header>
      {children}
    </section>
  );
}

function MaterialTitleBar({
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
      <div className="app-window-title">{text.appWindowTitle}</div>
      <div className="compact-brand">
        <div>
          <strong>{text.appName}</strong>
          <span>{languageRoute || text.appSub}</span>
        </div>
      </div>
      <StatusChip status={status} />
      <div className="compact-window-actions">
        <SettingsButton onClick={onSettings} />
        <MaterialIconButton label={text.minimize} onClick={onMinimize}>
          -
        </MaterialIconButton>
        <MaterialIconButton label={text.close} onClick={onClose} danger>
          x
        </MaterialIconButton>
      </div>
    </header>
  );
}

function StatusChip({ status }: { status: UiStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      {statusLabel(status)}
    </span>
  );
}

function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <MaterialIconButton label={text.settings} onClick={onClick}>
      {"\u2699"}
    </MaterialIconButton>
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

function EmptyState({
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

  if (hasResult) return null;

  return (
    <section className="empty-state-card">
      <span>{hasResult ? text.resultShown : text.resultWaiting}</span>
    </section>
  );
}

function SourceTextExpansion({
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
  onSaveModelConfig: (name: string) => Promise<boolean>;
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
        </nav>

        <section className="settings-content">
          <header>
            <strong>API {"\u8bbe\u7f6e"}</strong>
            <div className="settings-header-actions">
              <MaterialIconButton label={text.minimize} onClick={() => void window.translatorApi.minimizeWindow()}>
                -
              </MaterialIconButton>
              <MaterialIconButton label={text.close} onClick={onClose}>
                x
              </MaterialIconButton>
            </div>
          </header>

          <div className="settings-grid">
            <Field label={text.savedModels} hint={text.modelPresetNote}>
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
            <Field label={text.accountKey}>
              <input type="password" value={settings.apiKey} onChange={(event) => onChange({ ...settings, apiKey: event.target.value })} placeholder="sk-..." />
            </Field>
            <Field label="Base URL">
              <input type="text" value={settings.baseUrl} onChange={(event) => onChange({ ...settings, baseUrl: event.target.value })} />
            </Field>
            <Field label={text.model}>
              <input type="text" value={settings.model} onChange={(event) => onChange({ ...settings, model: event.target.value })} />
            </Field>
            <Field label={text.shortcut}>
              <input value={settings.shortcut} onChange={(event) => onChange({ ...settings, shortcut: event.target.value || "F2" })} placeholder="F2" />
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
                    void onSaveModelConfig(newModelName).then((saved) => {
                      if (saved) setNewModelName("");
                    });
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
            <Field label={text.tlsVerify}>
              <select value={settings.tlsVerify ? "true" : "false"} onChange={(event) => onChange({ ...settings, tlsVerify: event.target.value === "true" })}>
                <option value="true">{text.tlsEnabled}</option>
                <option value="false">{text.tlsDisabled}</option>
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

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function MaterialIconButton({
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

function LoadingState({ children }: { children: ReactNode }) {
  return (
    <div className="selecting-hint">
      <span className="mini-spinner" />
      {children}
    </div>
  );
}

function ErrorState({ children }: { children: ReactNode }) {
  return <div className="compact-error">{children}</div>;
}

function Snackbar({ children }: { children: ReactNode }) {
  return <div className="snackbar">{children}</div>;
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
