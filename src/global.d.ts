import type { TranslatorApi } from "../electron/preload";

declare global {
  interface Window {
    translatorApi: TranslatorApi;
  }
}

export {};
