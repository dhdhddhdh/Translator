import {
  BrowserWindow,
  Menu,
  Tray,
  app,
  globalShortcut,
  ipcMain,
  nativeImage,
  nativeTheme,
  screen,
  shell
} from "electron";
import path from "node:path";
import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { captureSelection } from "./capture";
import { recognizeTextFromBuffer, shutdownOcr } from "./ocr";
import { loadSettings, saveSettings } from "./settings";
import { translateBlocksToChinese, translateToChinese } from "./translate";
import type { AppSettings, OcrBlock, SelectionBounds, SelectionMode, TranslationCanvas, TranslationPayload } from "./types";

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let regionWindow: BrowserWindow | null = null;
let resultWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let settingsCache: AppSettings;
let overlayMode: SelectionMode = "single";
let monitorRegion: SelectionBounds | null = null;
let monitorTimer: NodeJS.Timeout | null = null;
let monitorBusy = false;
let lastMonitorText = "";
let isQuitting = false;
let activeTranslationController: AbortController | null = null;
const allWindows = new Set<BrowserWindow>();
const translationCache = new Map<string, string>();
const blockTranslationCache = new Map<string, TranslationPayload>();
let lastResultPayload: TranslationPayload | null = null;

function registerWindow(win: BrowserWindow) {
  allWindows.add(win);

  win.on("closed", () => {
    allWindows.delete(win);
    if (win === mainWindow) mainWindow = null;
    if (win === overlayWindow) overlayWindow = null;
    if (win === regionWindow) regionWindow = null;
    if (win === resultWindow) resultWindow = null;
  });

  return win;
}

function createMainWindow() {
  mainWindow = registerWindow(new BrowserWindow({
    width: 460,
    height: 430,
    minWidth: 400,
    minHeight: 340,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  }));

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    if (settingsCache.closeBehavior === "exit") {
      event.preventDefault();
      quitApp();
      return;
    }

    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  applyOpacity(settingsCache.opacity);

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

function createResultWindow(payload?: TranslationPayload) {
  if (payload) {
    lastResultPayload = payload;
  }

  if (resultWindow && !resultWindow.isDestroyed()) {
    resultWindow.show();
    resultWindow.focus();
    sendToResult("result:update", lastResultPayload);
    return;
  }

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const width = 520;
  const height = 430;

  resultWindow = registerWindow(new BrowserWindow({
    x: Math.round(display.workArea.x + display.workArea.width - width - 24),
    y: Math.round(display.workArea.y + 78),
    width,
    height,
    minWidth: 380,
    minHeight: 320,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  }));

  resultWindow.on("ready-to-show", () => {
    resultWindow?.show();
  });

  resultWindow.webContents.once("did-finish-load", () => {
    sendToResult("result:update", lastResultPayload);
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void resultWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/result.html`);
  } else {
    void resultWindow.loadFile(path.join(__dirname, "../renderer/result.html"));
  }
}

function createRegionWindow(selection: SelectionBounds) {
  closeRegionWindow();

  regionWindow = registerWindow(new BrowserWindow({
    x: Math.round(selection.x),
    y: Math.round(selection.y),
    width: Math.round(selection.width),
    height: Math.round(selection.height),
    minWidth: 60,
    minHeight: 40,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  }));

  regionWindow.setAlwaysOnTop(true, "screen-saver");

  regionWindow.on("move", () => {
    if (!regionWindow || regionWindow.isDestroyed() || !monitorRegion) return;
    const [x, y] = regionWindow.getPosition();
    const display = screen.getDisplayNearestPoint({ x, y });
    monitorRegion = {
      ...monitorRegion,
      x,
      y,
      displayId: display.id,
      scaleFactor: display.scaleFactor
    };
    lastMonitorText = "";
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void regionWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/region.html`);
  } else {
    void regionWindow.loadFile(path.join(__dirname, "../renderer/region.html"));
  }
}

function createOverlayWindow(mode: SelectionMode) {
  closeOverlayWindow();
  overlayMode = mode;
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);

  overlayWindow = registerWindow(new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    transparent: true,
    movable: false,
    resizable: false,
    alwaysOnTop: true,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  }));

  overlayWindow.once("ready-to-show", () => {
    overlayWindow?.show();
    overlayWindow?.focus();
  });

  overlayWindow.webContents.once("did-finish-load", () => {
    overlayWindow?.webContents.send("overlay-context", {
      displayId: display.id,
      originX: display.bounds.x,
      originY: display.bounds.y,
      scaleFactor: display.scaleFactor,
      mode
    });
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void overlayWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay.html`);
  } else {
    void overlayWindow.loadFile(path.join(__dirname, "../renderer/overlay.html"));
  }
}

function getTrayIcon() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "icons", "icon.ico")
    : path.resolve(app.getAppPath(), "build", "icon.ico");
  const image = nativeImage.createFromPath(iconPath);
  return image.isEmpty() ? nativeImage.createFromPath(process.execPath) : image;
}

function createTray() {
  tray?.destroy();
  tray = new Tray(getTrayIcon());
  tray.setToolTip("Screen Translator");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "\u663e\u793a\u4e3b\u7a97\u53e3",
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        }
      },
      {
        label: "\u505c\u6b62\u81ea\u52a8\u7ffb\u8bd1",
        click: () => stopRealtimeMonitoring()
      },
      { type: "separator" },
      {
        label: "\u9000\u51fa\u8f6f\u4ef6",
        click: () => quitApp()
      }
    ])
  );

  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function registerShortcuts() {
  globalShortcut.unregisterAll();
  globalShortcut.register(settingsCache.shortcut || "F2", () => {
    if (!overlayWindow) {
      createOverlayWindow("single");
    }
  });
}

function applyOpacity(opacity: number) {
  // Keep text fully opaque. Transparency is handled by CSS panels and the transparent window background.
  mainWindow?.setOpacity(1);
}

function emitRealtimeState(active: boolean) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("realtime-state", active);
}

function sendToMain(channel: string, ...args: unknown[]) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, ...args);
}

function sendToResult(channel: string, ...args: unknown[]) {
  if (!resultWindow || resultWindow.isDestroyed()) return;
  resultWindow.webContents.send(channel, ...args);
}

function showTranslationResult(payload: TranslationPayload) {
  const enrichedPayload: TranslationPayload = {
    ...payload,
    model: settingsCache.model,
    sourceLanguage: settingsCache.sourceLanguage,
    targetLanguage: settingsCache.targetLanguageCode,
    updatedAt: Date.now()
  };
  lastResultPayload = enrichedPayload;
  createResultWindow(enrichedPayload);
  sendToResult("result:update", enrichedPayload);
}

function normalizeText(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function sortOcrBlocks(blocks: OcrBlock[]) {
  return [...blocks].sort((a, b) => {
    const ay = a.box?.y ?? a.lineIndex ?? 0;
    const by = b.box?.y ?? b.lineIndex ?? 0;
    const ax = a.box?.x ?? 0;
    const bx = b.box?.x ?? 0;
    const lineThreshold = Math.max(8, Math.min(a.box?.height ?? 12, b.box?.height ?? 12) * 0.65);

    if (Math.abs(ay - by) <= lineThreshold) {
      return ax - bx;
    }
    return ay - by;
  });
}

function getTranslationCacheKey(sourceText: string) {
  return JSON.stringify({
    sourceText,
    sourceLanguage: settingsCache.sourceLanguage,
    targetLanguage: settingsCache.targetLanguageCode,
    provider: settingsCache.provider,
    model: settingsCache.model
  });
}

function getBlockTranslationCacheKey(blocks: OcrBlock[]) {
  return JSON.stringify({
    blocks: blocks.map((block) => ({ id: block.id, text: block.text })),
    sourceLanguage: settingsCache.sourceLanguage,
    targetLanguage: settingsCache.targetLanguageCode,
    provider: settingsCache.provider,
    model: settingsCache.model
  });
}

async function translateText(sourceText: string) {
  const normalized = normalizeText(sourceText);
  if (!normalized) {
    throw new Error("\u672a\u8bc6\u522b\u5230\u53ef\u7ffb\u8bd1\u6587\u5b57");
  }

  if (!settingsCache.apiKey) {
    throw new Error("\u8bf7\u5148\u5728\u8bbe\u7f6e\u4e2d\u586b\u5199 API Key");
  }

  if (!settingsCache.baseUrl || !settingsCache.model) {
    throw new Error("\u8bf7\u5148\u5728\u8bbe\u7f6e\u4e2d\u586b\u5199 Base URL \u548c\u6a21\u578b\u540d");
  }

  const cacheKey = getTranslationCacheKey(normalized);
  const cached = translationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  activeTranslationController?.abort();
  activeTranslationController = new AbortController();
  let translated;
  try {
    translated = await translateToChinese(normalized, settingsCache, {
      signal: activeTranslationController.signal,
      onDelta: (partialText) => {
        sendToMain("translation-stream", partialText);
      }
    });
  } finally {
    activeTranslationController = null;
  }
  translationCache.set(cacheKey, translated.translated_text);
  return translated.translated_text;
}

async function translateOcrBlocks(blocks: OcrBlock[], canvas?: TranslationCanvas): Promise<TranslationPayload> {
  const sortedBlocks = sortOcrBlocks(blocks).filter((block) => normalizeText(block.text));
  const sourceText = sortedBlocks.map((block) => block.text.trim()).join("\n");
  const normalized = normalizeText(sourceText);

  if (!normalized) {
    throw new Error("\u672a\u8bc6\u522b\u5230\u53ef\u7ffb\u8bd1\u6587\u5b57");
  }

  if (!settingsCache.apiKey) {
    throw new Error("\u8bf7\u5148\u5728\u8bbe\u7f6e\u4e2d\u586b\u5199 API Key");
  }

  if (!settingsCache.baseUrl || !settingsCache.model) {
    throw new Error("\u8bf7\u5148\u5728\u8bbe\u7f6e\u4e2d\u586b\u5199 Base URL \u548c\u6a21\u578b\u540d");
  }

  const cacheKey = getBlockTranslationCacheKey(sortedBlocks);
  const cached = blockTranslationCache.get(cacheKey);
  if (cached) return cached;

  activeTranslationController?.abort();
  activeTranslationController = new AbortController();
  try {
    const translatedBlocks = await translateBlocksToChinese(sortedBlocks, settingsCache, {
      signal: activeTranslationController.signal
    });
    const translatedText = translatedBlocks
      .map((block) => block.translatedText || "\u672a\u7ffb\u8bd1")
      .join("\n");
    const payload: TranslationPayload = {
      sourceText,
      translatedText,
      blocks: translatedBlocks,
      canvas
    };
    blockTranslationCache.set(cacheKey, payload);
    return payload;
  } finally {
    activeTranslationController = null;
  }
}

async function processImageBuffer(imageBuffer: Buffer, source: "single" | "monitor", canvasHint?: TranslationCanvas) {
  if (!mainWindow) return;

  const ocrResult = await recognizeTextFromBuffer(imageBuffer, settingsCache.ocrEngine);
  const sortedBlocks = sortOcrBlocks(ocrResult.blocks);
  const text = normalizeText(ocrResult.text || sortedBlocks.map((block) => block.text).join("\n"));

  if (!text) {
    if (source === "single") {
      throw new Error("\u672a\u8bc6\u522b\u5230\u53ef\u7ffb\u8bd1\u6587\u5b57");
    }
    return;
  }

  sendToMain("ocr-result", `[OCR: ${ocrResult.engine}] ${text}`);
  sendToMain("translation-status", "translating");

  const canvas = ocrResult.canvas ?? canvasHint;
  const translated = sortedBlocks.length
    ? await translateOcrBlocks(sortedBlocks, canvas)
    : {
        sourceText: text,
        translatedText: await translateText(text),
        canvas
      };
  const payload: TranslationPayload = {
    ...translated,
    mode: source
  };
  showTranslationResult(payload);
  sendToMain("translation-complete", payload);
}

async function handleSelection(selection: SelectionBounds) {
  if (!mainWindow) return;

  try {
    sendToMain("translation-status", "capturing");
    const imageBuffer = await captureSelection(selection);
    await processImageBuffer(imageBuffer, "single", {
      width: Math.max(1, Math.round(selection.width * (selection.scaleFactor || 1))),
      height: Math.max(1, Math.round(selection.height * (selection.scaleFactor || 1)))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "\u5904\u7406\u622a\u56fe\u65f6\u53d1\u751f\u672a\u77e5\u9519\u8bef";
    sendToMain("translation-error", message);
  } finally {
    sendToMain("translation-status", monitorTimer ? "monitoring" : "idle");
  }
}

async function runMonitorTick() {
  if (!monitorRegion || monitorBusy || !mainWindow) {
    return;
  }

  monitorBusy = true;
  try {
    const imageBuffer = await captureSelection(monitorRegion);
    const ocrResult = await recognizeTextFromBuffer(imageBuffer, settingsCache.ocrEngine);
    const sortedBlocks = sortOcrBlocks(ocrResult.blocks);
    const text = normalizeText(ocrResult.text || sortedBlocks.map((block) => block.text).join("\n"));

    if (!text || text === lastMonitorText) {
      return;
    }

    lastMonitorText = text;
    sendToMain("ocr-result", `[OCR: ${ocrResult.engine}] ${text}`);
    sendToMain("translation-status", "translating");

    const canvas = ocrResult.canvas ?? {
      width: Math.max(1, Math.round(monitorRegion.width * (monitorRegion.scaleFactor || 1))),
      height: Math.max(1, Math.round(monitorRegion.height * (monitorRegion.scaleFactor || 1)))
    };
    const translated = sortedBlocks.length
      ? await translateOcrBlocks(sortedBlocks, canvas)
      : {
          sourceText: text,
          translatedText: await translateText(text),
          canvas
        };
    const payload: TranslationPayload = {
      ...translated,
      mode: "monitor"
    };
    showTranslationResult(payload);
    sendToMain("translation-complete", payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "\u5b9e\u65f6\u7ffb\u8bd1\u65f6\u53d1\u751f\u9519\u8bef";
    sendToMain("translation-error", message);
  } finally {
    monitorBusy = false;
    sendToMain("translation-status", monitorTimer ? "monitoring" : "idle");
  }
}

function stopRealtimeMonitoring() {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
  monitorRegion = null;
  lastMonitorText = "";
  settingsCache = { ...settingsCache, realtimeEnabled: false };
  closeRegionWindow();
  emitRealtimeState(false);
  sendToMain("translation-status", "idle");
}

function closeOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy();
  }
  overlayWindow = null;
}

function closeRegionWindow() {
  if (regionWindow && !regionWindow.isDestroyed()) {
    regionWindow.destroy();
  }
  regionWindow = null;
}

function closeResultWindow() {
  if (resultWindow && !resultWindow.isDestroyed()) {
    resultWindow.destroy();
  }
  resultWindow = null;
}

function destroyAllWindows() {
  for (const win of allWindows) {
    if (!win.isDestroyed()) {
      win.destroy();
    }
  }
  allWindows.clear();
  mainWindow = null;
  overlayWindow = null;
  regionWindow = null;
  resultWindow = null;
}

function cleanupAppResources(options: { destroyWindows?: boolean; removeIpc?: boolean } = {}) {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
  monitorRegion = null;
  monitorBusy = false;
  lastMonitorText = "";

  activeTranslationController?.abort();
  activeTranslationController = null;
  void shutdownOcr();

  globalShortcut.unregisterAll();
  tray?.destroy();
  tray = null;

  if (options.destroyWindows) {
    destroyAllWindows();
  } else {
    closeOverlayWindow();
    closeRegionWindow();
    closeResultWindow();
  }

  if (options.removeIpc) {
    ipcMain.removeHandler("settings:get");
    ipcMain.removeHandler("settings:save");
    ipcMain.removeHandler("translation:start-selection");
    ipcMain.removeHandler("translation:translate-text");
    ipcMain.removeHandler("translation:stop-realtime");
    ipcMain.removeHandler("window:minimize");
    ipcMain.removeHandler("window:close");
    ipcMain.removeHandler("window:set-opacity");
    ipcMain.removeHandler("result:close");
    ipcMain.removeAllListeners("selection:cancel");
    ipcMain.removeAllListeners("selection:confirm");
  }
}

function quitApp() {
  if (isQuitting) return;
  isQuitting = true;
  cleanupAppResources({ destroyWindows: true, removeIpc: true });
  app.quit();
}

function startRealtimeMonitoring(selection: SelectionBounds) {
  monitorRegion = selection;
  lastMonitorText = "";
  settingsCache = { ...settingsCache, realtimeEnabled: true };
  createRegionWindow(selection);

  if (monitorTimer) {
    clearInterval(monitorTimer);
  }

  monitorTimer = setInterval(() => {
    void runMonitorTick();
  }, Math.max(800, settingsCache.refreshIntervalMs));

  emitRealtimeState(true);
  sendToMain("translation-status", "monitoring");
  void runMonitorTick();
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.openai.screen-translator");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  settingsCache = loadSettings();
  nativeTheme.themeSource = settingsCache.theme === "light" ? "light" : "dark";
  createMainWindow();
  createTray();
  registerShortcuts();

  ipcMain.handle("settings:get", () => settingsCache);
  ipcMain.handle("settings:save", (_, nextSettings: AppSettings) => {
    settingsCache = saveSettings(nextSettings);
    registerShortcuts();
    applyOpacity(settingsCache.opacity);
    nativeTheme.themeSource = settingsCache.theme === "light" ? "light" : "dark";

    if (monitorTimer) {
      clearInterval(monitorTimer);
      monitorTimer = setInterval(() => {
        void runMonitorTick();
      }, Math.max(800, settingsCache.refreshIntervalMs));
    }

    return settingsCache;
  });
  ipcMain.handle("translation:start-selection", (_, mode: SelectionMode = "single") => {
    if (!overlayWindow) createOverlayWindow(mode);
  });
  ipcMain.handle("translation:translate-text", async (_, sourceText: string) => {
    const normalized = normalizeText(sourceText);
    const translatedText = await translateText(normalized);
    const payload: TranslationPayload = {
      sourceText: normalized,
      translatedText,
      model: settingsCache.model,
      sourceLanguage: settingsCache.sourceLanguage,
      targetLanguage: settingsCache.targetLanguageCode,
      updatedAt: Date.now()
    };
    showTranslationResult(payload);
    return payload;
  });
  ipcMain.handle("translation:stop-realtime", () => {
    stopRealtimeMonitoring();
  });
  ipcMain.handle("window:minimize", () => mainWindow?.minimize());
  ipcMain.handle("window:close", () => {
    if (settingsCache.closeBehavior === "minimize-to-tray" && !isQuitting) {
      mainWindow?.hide();
      return;
    }
    quitApp();
  });
  ipcMain.handle("window:set-opacity", (_, value: number) => applyOpacity(value));
  ipcMain.handle("result:close", () => closeResultWindow());

  ipcMain.on("selection:cancel", () => {
    closeOverlayWindow();
  });

  ipcMain.on("selection:confirm", (_, selection: SelectionBounds) => {
    const mode = overlayMode;
    closeOverlayWindow();

    if (mode === "monitor") {
      startRealtimeMonitoring(selection);
      return;
    }

    void handleSelection(selection);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("will-quit", () => {
  isQuitting = true;
  cleanupAppResources({ destroyWindows: true, removeIpc: true });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    quitApp();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  cleanupAppResources({ destroyWindows: true });
});
