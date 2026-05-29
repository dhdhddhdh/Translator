export type OcrEngine = "auto" | "windows" | "tesseract";
export type SelectionMode = "single" | "monitor";

export type TranslationProvider = "custom" | "deepseek" | "openai" | "openrouter" | "siliconflow";
export type SourceLanguage = "auto" | "en" | "ja" | "ko" | "zh-TW" | "fr" | "de" | "es" | "ru";
export type TargetLanguage = "zh-CN" | "zh-TW" | "en" | "ja" | "ko";
export type CloseBehavior = "minimize-to-tray" | "exit";

export type SavedModelConfig = {
  id: string;
  name: string;
  provider: TranslationProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
};

export type AppSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: TranslationProvider;
  sourceLanguage: SourceLanguage;
  targetLanguage: string;
  targetLanguageCode: TargetLanguage;
  closeBehavior: CloseBehavior;
  shortcut: string;
  ocrEngine: OcrEngine;
  refreshIntervalMs: number;
  fontSize: number;
  opacity: number;
  realtimeEnabled: boolean;
  theme: "dark" | "light";
  tlsVerify: boolean;
  savedModels: SavedModelConfig[];
};

export type SelectionBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  displayId: number;
  scaleFactor: number;
};

export type OcrBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrBlock = {
  id: string;
  text: string;
  box?: OcrBox;
  confidence?: number;
  lineIndex?: number;
  blockIndex?: number;
};

export type TranslationBlock = {
  id: string;
  sourceText: string;
  translatedText: string;
  box?: OcrBox;
  confidence?: number;
};

export type TranslationCanvas = {
  width: number;
  height: number;
};

export type TranslationPayload = {
  sourceText: string;
  translatedText: string;
  blocks?: TranslationBlock[];
  canvas?: TranslationCanvas;
  model?: string;
  sourceLanguage?: SourceLanguage;
  targetLanguage?: TargetLanguage;
  mode?: SelectionMode;
  updatedAt?: number;
};

export type OcrResult = {
  text: string;
  blocks: OcrBlock[];
  canvas?: TranslationCanvas;
  engine: "windows" | "tesseract";
};
