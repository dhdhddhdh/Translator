import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { SourceLanguage, TargetLanguage, TranslationBlock, TranslationPayload } from "../electron/main/types";
import "./styles.css";

type DisplayMode = "layout" | "list" | "text";
type TextMode = "translated" | "source" | "bilingual";

const labels = {
  empty: "\u7b49\u5f85\u5c4f\u5e55\u6587\u5b57\u7ffb\u8bd1\u7ed3\u679c...",
  source: "\u8bc6\u522b\u539f\u6587",
  copy: "\u590d\u5236",
  copied: "\u5df2\u590d\u5236",
  copyJson: "\u590d\u5236 JSON",
  retry: "\u91cd\u65b0\u7ffb\u8bd1",
  pin: "\u56fa\u5b9a",
  unpin: "\u53d6\u6d88\u56fa\u5b9a",
  live: "\u5b9e\u65f6\u4e2d",
  updated: "\u5df2\u66f4\u65b0",
  model: "\u6a21\u578b",
  layout: "\u7248\u9762",
  list: "\u5217\u8868",
  text: "\u6587\u672c",
  translated: "\u8bd1\u6587",
  sourceOnly: "\u539f\u6587",
  bilingual: "\u53cc\u8bed",
  untranslated: "\u672a\u7ffb\u8bd1",
  fallback: "\u5f53\u524d OCR \u6ca1\u6709\u5750\u6807\u4fe1\u606f\uff0c\u5df2\u5207\u6362\u4e3a\u6587\u672c\u6a21\u5f0f\u3002",
  routeAuto: "\u81ea\u52a8\u8bc6\u522b",
  zhCn: "\u7b80\u4f53\u4e2d\u6587",
  zhTw: "\u7e41\u4f53\u4e2d\u6587",
  en: "\u82f1\u8bed",
  ja: "\u65e5\u8bed",
  ko: "\u97e9\u8bed",
  fr: "\u6cd5\u8bed",
  de: "\u5fb7\u8bed",
  es: "\u897f\u73ed\u7259\u8bed",
  ru: "\u4fc4\u8bed"
};

function FloatingResultWindow() {
  const [payload, setPayload] = useState<TranslationPayload | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("layout");
  const [textMode, setTextMode] = useState<TextMode>("translated");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pinned, setPinned] = useState(true);

  useEffect(() => {
    window.translatorApi.onResultUpdate((nextPayload) => {
      setPayload(nextPayload);
      setCopied(false);
      setDisplayMode(defaultDisplayMode(nextPayload));
    });
  }, []);

  const blocks = useMemo(() => sortBlocks(payload?.blocks ?? []), [payload?.blocks]);
  const effectiveMode = getEffectiveDisplayMode(displayMode, payload, blocks);
  const route = payload
    ? `${sourceLabel(payload.sourceLanguage)} \u2192 ${targetLabel(payload.targetLanguage)}`
    : `${labels.routeAuto} \u2192 ${labels.zhCn}`;

  async function copyResult() {
    await navigator.clipboard.writeText(getPlainText(payload, blocks, textMode));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  async function copyJson() {
    const json = JSON.stringify(
      blocks.map((block) => ({
        sourceText: block.sourceText,
        translatedText: block.translatedText,
        box: block.box
      })),
      null,
      2
    );
    await navigator.clipboard.writeText(json || "[]");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  async function retry() {
    if (!payload?.sourceText) return;
    setBusy(true);
    try {
      const next = await window.translatorApi.translateText(payload.sourceText);
      setPayload(next);
      setDisplayMode(defaultDisplayMode(next));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="result-window-shell">
      <section className="result-window-panel">
        <header className="result-window-titlebar window-drag-layer">
          <div className="result-window-brand">
            <div>
              <strong>{route}</strong>
              <span>{payload?.model ? `${labels.model}: ${payload.model}` : labels.empty}</span>
            </div>
          </div>
          <StatusPill active={payload?.mode === "monitor"} />
          <button className="result-close" onClick={() => void window.translatorApi.closeResultWindow()}>
            x
          </button>
        </header>

        <main className="result-window-body">
          <ModeSwitcher value={displayMode} effectiveValue={effectiveMode} onChange={setDisplayMode} />
          <TextModeSwitcher value={textMode} onChange={setTextMode} />

          <TranslationResultCard
            payload={payload}
            blocks={blocks}
            displayMode={effectiveMode}
            textMode={textMode}
          />

          {displayMode === "layout" && effectiveMode !== "layout" ? <div className="layout-fallback-note">{labels.fallback}</div> : null}

          <div className="result-window-actions">
            <button onClick={() => void copyResult()}>{copied ? labels.copied : labels.copy}</button>
            <button onClick={() => void copyJson()} disabled={!blocks.length}>{labels.copyJson}</button>
            <button onClick={() => void retry()} disabled={!payload?.sourceText || busy}>
              {busy ? "..." : labels.retry}
            </button>
            <button onClick={() => setPinned((current) => !current)}>
              {pinned ? labels.unpin : labels.pin}
            </button>
          </div>
        </main>
      </section>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={active ? "result-status is-live" : "result-status"}>
      <span />
      {active ? labels.live : labels.updated}
    </span>
  );
}

function ModeSwitcher({
  value,
  effectiveValue,
  onChange
}: {
  value: DisplayMode;
  effectiveValue: DisplayMode;
  onChange: (value: DisplayMode) => void;
}) {
  return (
    <div className="result-mode-switcher" aria-label="\u663e\u793a\u6a21\u5f0f">
      {(["layout", "list", "text"] as DisplayMode[]).map((mode) => (
        <button
          key={mode}
          className={value === mode || effectiveValue === mode ? "is-active" : ""}
          onClick={() => onChange(mode)}
        >
          {modeLabel(mode)}
        </button>
      ))}
    </div>
  );
}

function TextModeSwitcher({ value, onChange }: { value: TextMode; onChange: (value: TextMode) => void }) {
  return (
    <div className="result-mode-switcher subtle" aria-label="\u6587\u672c\u663e\u793a">
      {(["translated", "source", "bilingual"] as TextMode[]).map((mode) => (
        <button key={mode} className={value === mode ? "is-active" : ""} onClick={() => onChange(mode)}>
          {textModeLabel(mode)}
        </button>
      ))}
    </div>
  );
}

function TranslationResultCard({
  payload,
  blocks,
  displayMode,
  textMode
}: {
  payload: TranslationPayload | null;
  blocks: TranslationBlock[];
  displayMode: DisplayMode;
  textMode: TextMode;
}) {
  if (!payload) {
    return <section className="floating-result-card is-empty">{labels.empty}</section>;
  }

  if (displayMode === "layout") {
    return <LayoutTranslationCanvas payload={payload} blocks={blocks} textMode={textMode} />;
  }

  if (displayMode === "list") {
    return <TranslationList blocks={blocks} textMode={textMode} fallbackText={payload.translatedText} />;
  }

  return <TranslationText text={getPlainText(payload, blocks, textMode)} />;
}

function LayoutTranslationCanvas({
  payload,
  blocks,
  textMode
}: {
  payload: TranslationPayload;
  blocks: TranslationBlock[];
  textMode: TextMode;
}) {
  const canvas = payload.canvas ?? inferCanvas(blocks);
  const safeWidth = Math.max(1, canvas?.width ?? 1);
  const safeHeight = Math.max(1, canvas?.height ?? 1);
  const scale = Math.min(1, 468 / safeWidth, 270 / safeHeight);
  const width = Math.max(320, Math.round(safeWidth * scale));
  const layoutItems = buildLayoutItems(blocks, scale, width);
  const height = Math.max(150, Math.round(safeHeight * scale), Math.ceil(Math.max(...layoutItems.map((item) => item.top + item.height), 0) + 10));

  return (
    <section className="layout-result-shell">
      <div className="layout-translation-canvas" style={{ width, height }}>
        {layoutItems.map((item) => {
          const { block } = item;
          return (
            <div
              key={block.id}
              className="translation-block"
              style={{
                left: item.left,
                top: item.top,
                width: item.width,
                minHeight: item.height
              }}
            >
              <BlockText block={block} textMode={textMode} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TranslationList({
  blocks,
  textMode,
  fallbackText
}: {
  blocks: TranslationBlock[];
  textMode: TextMode;
  fallbackText: string;
}) {
  if (!blocks.length) return <TranslationText text={fallbackText} />;

  return (
    <section className="translation-list">
      {blocks.map((block) => (
        <div key={block.id} className="translation-list-item">
          <BlockText block={block} textMode={textMode} />
        </div>
      ))}
    </section>
  );
}

function TranslationText({ text }: { text: string }) {
  return <section className="floating-result-card"><div className="floating-result-text">{text || labels.empty}</div></section>;
}

function BlockText({ block, textMode }: { block: TranslationBlock; textMode: TextMode }) {
  const translated = block.translatedText || labels.untranslated;
  if (textMode === "source") return <span>{block.sourceText}</span>;
  if (textMode === "bilingual") {
    return (
      <>
        <small>{block.sourceText}</small>
        <span>{translated}</span>
      </>
    );
  }
  return <span>{translated}</span>;
}

function defaultDisplayMode(payload: TranslationPayload | null): DisplayMode {
  const blocks = payload?.blocks ?? [];
  if (!blocks.length || !blocks.some((block) => block.box)) return "text";
  if (blocks.length > 120) return "list";
  return "layout";
}

function getEffectiveDisplayMode(mode: DisplayMode, payload: TranslationPayload | null, blocks: TranslationBlock[]): DisplayMode {
  if (!payload) return "text";
  if (mode === "layout" && (!blocks.length || !blocks.some((block) => block.box))) return "text";
  if (mode === "layout" && blocks.length > 120) return "list";
  return mode;
}

function sortBlocks(blocks: TranslationBlock[]) {
  return [...blocks].sort((a, b) => {
    const ay = a.box?.y ?? 0;
    const by = b.box?.y ?? 0;
    const ax = a.box?.x ?? 0;
    const bx = b.box?.x ?? 0;
    const threshold = Math.max(8, Math.min(a.box?.height ?? 12, b.box?.height ?? 12) * 0.65);
    if (Math.abs(ay - by) <= threshold) return ax - bx;
    return ay - by;
  });
}

function buildLayoutItems(blocks: TranslationBlock[], scale: number, canvasWidth: number) {
  const items = blocks
    .filter((block) => block.box)
    .map((block) => {
      const box = block.box!;
      const textLength = (block.translatedText || block.sourceText).trim().length;
      const sourceLength = block.sourceText.trim().length;
      const left = Math.max(0, box.x * scale);
      const baseWidth = Math.max(64, box.width * scale);
      const needsExpansion = textLength > 18 || textLength > Math.max(10, sourceLength * 1.35);
      const availableWidth = Math.max(80, canvasWidth - left - 8);
      const width = Math.min(availableWidth, needsExpansion ? Math.max(baseWidth, Math.min(280, availableWidth)) : baseWidth);
      const charsPerLine = Math.max(4, Math.floor(width / 7.2));
      const estimatedLines = Math.max(1, Math.ceil(textLength / charsPerLine));
      const height = Math.max(24, box.height * scale, estimatedLines * 22 + 12);

      return {
        block,
        left,
        top: Math.max(0, box.y * scale),
        width,
        height
      };
    })
    .sort((a, b) => (Math.abs(a.top - b.top) <= 8 ? a.left - b.left : a.top - b.top));

  const placed: typeof items = [];
  for (const item of items) {
    let nextTop = item.top;
    let guard = 0;

    while (
      placed.some((placedItem) => boxesOverlap({ ...item, top: nextTop }, placedItem)) &&
      guard < 80
    ) {
      const blockers = placed.filter((placedItem) => boxesOverlap({ ...item, top: nextTop }, placedItem));
      nextTop = Math.max(...blockers.map((blocker) => blocker.top + blocker.height + 8), nextTop + 8);
      guard += 1;
    }

    placed.push({ ...item, top: nextTop });
  }

  return placed;
}

function boxesOverlap(
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number }
) {
  const horizontalPadding = 5;
  const verticalPadding = 7;
  return (
    a.left < b.left + b.width + horizontalPadding &&
    a.left + a.width + horizontalPadding > b.left &&
    a.top < b.top + b.height + verticalPadding &&
    a.top + a.height + verticalPadding > b.top
  );
}

function inferCanvas(blocks: TranslationBlock[]) {
  const boxed = blocks.filter((block) => block.box);
  if (!boxed.length) return undefined;
  return {
    width: Math.ceil(Math.max(...boxed.map((block) => block.box!.x + block.box!.width))),
    height: Math.ceil(Math.max(...boxed.map((block) => block.box!.y + block.box!.height)))
  };
}

function getPlainText(payload: TranslationPayload | null, blocks: TranslationBlock[], textMode: TextMode) {
  if (!payload) return "";
  if (!blocks.length) return textMode === "source" ? payload.sourceText : payload.translatedText;

  return blocks
    .map((block) => {
      if (textMode === "source") return block.sourceText;
      if (textMode === "bilingual") return `${block.sourceText}\n${block.translatedText || labels.untranslated}`;
      return block.translatedText || labels.untranslated;
    })
    .join("\n");
}

function modeLabel(mode: DisplayMode) {
  if (mode === "layout") return labels.layout;
  if (mode === "list") return labels.list;
  return labels.text;
}

function textModeLabel(mode: TextMode) {
  if (mode === "source") return labels.sourceOnly;
  if (mode === "bilingual") return labels.bilingual;
  return labels.translated;
}

function sourceLabel(source?: SourceLanguage) {
  if (source === "en") return labels.en;
  if (source === "ja") return labels.ja;
  if (source === "ko") return labels.ko;
  if (source === "zh-TW") return labels.zhTw;
  if (source === "fr") return labels.fr;
  if (source === "de") return labels.de;
  if (source === "es") return labels.es;
  if (source === "ru") return labels.ru;
  return labels.routeAuto;
}

function targetLabel(target?: TargetLanguage) {
  if (target === "zh-TW") return labels.zhTw;
  if (target === "en") return labels.en;
  if (target === "ja") return labels.ja;
  if (target === "ko") return labels.ko;
  return labels.zhCn;
}

createRoot(document.getElementById("result-root")!).render(<FloatingResultWindow />);
