import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, SelectionBounds, SelectionMode, TranslationPayload } from "../main/types";

const api = {
  getSettings: () => ipcRenderer.invoke("settings:get") as Promise<AppSettings>,
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke("settings:save", settings) as Promise<AppSettings>,
  startSelection: (mode: SelectionMode = "single") =>
    ipcRenderer.invoke("translation:start-selection", mode) as Promise<void>,
  translateText: (text: string) => ipcRenderer.invoke("translation:translate-text", text) as Promise<TranslationPayload>,
  stopRealtime: () => ipcRenderer.invoke("translation:stop-realtime") as Promise<void>,
  minimizeWindow: () => ipcRenderer.invoke("window:minimize") as Promise<void>,
  closeWindow: () => ipcRenderer.invoke("window:close") as Promise<void>,
  closeResultWindow: () => ipcRenderer.invoke("result:close") as Promise<void>,
  setOpacity: (value: number) => ipcRenderer.invoke("window:set-opacity", value) as Promise<void>,
  confirmSelection: (selection: SelectionBounds) => ipcRenderer.send("selection:confirm", selection),
  cancelSelection: () => ipcRenderer.send("selection:cancel"),
  onOverlayContext: (
    callback: (payload: {
      displayId: number;
      originX: number;
      originY: number;
      scaleFactor: number;
      mode: SelectionMode;
    }) => void
  ) => ipcRenderer.on("overlay-context", (_, payload) => callback(payload)),
  onRealtimeState: (callback: (active: boolean) => void) =>
    ipcRenderer.on("realtime-state", (_, active) => callback(active)),
  onStatus: (callback: (status: string) => void) => ipcRenderer.on("translation-status", (_, status) => callback(status)),
  onStream: (callback: (text: string) => void) => ipcRenderer.on("translation-stream", (_, text) => callback(text)),
  onComplete: (callback: (payload: TranslationPayload) => void) =>
    ipcRenderer.on("translation-complete", (_, payload) => callback(payload)),
  onResultUpdate: (callback: (payload: TranslationPayload | null) => void) =>
    ipcRenderer.on("result:update", (_, payload) => callback(payload)),
  onError: (callback: (message: string) => void) => ipcRenderer.on("translation-error", (_, message) => callback(message)),
  onOcrResult: (callback: (text: string) => void) => ipcRenderer.on("ocr-result", (_, text) => callback(text))
};

contextBridge.exposeInMainWorld("translatorApi", api);

export type TranslatorApi = typeof api;
