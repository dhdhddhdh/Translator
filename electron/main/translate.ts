import type { AppSettings, OcrBlock, SourceLanguage, TargetLanguage, TranslationBlock } from "./types";

type StreamCallbacks = {
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
};

type TranslationResult = {
  detected_language: string;
  source_text: string;
  translated_text: string;
};

type BlockTranslationResult = {
  id: string;
  translatedText: string;
};

const sourceLanguageLabels: Record<SourceLanguage, string> = {
  auto: "\u81ea\u52a8\u8bc6\u522b",
  en: "\u82f1\u8bed",
  ja: "\u65e5\u8bed",
  ko: "\u97e9\u8bed",
  "zh-TW": "\u4e2d\u6587\u7e41\u4f53",
  fr: "\u6cd5\u8bed",
  de: "\u5fb7\u8bed",
  es: "\u897f\u73ed\u7259\u8bed",
  ru: "\u4fc4\u8bed"
};

const targetLanguageLabels: Record<TargetLanguage, string> = {
  "zh-CN": "\u7b80\u4f53\u4e2d\u6587",
  "zh-TW": "\u7e41\u4f53\u4e2d\u6587",
  en: "\u82f1\u8bed",
  ja: "\u65e5\u8bed",
  ko: "\u97e9\u8bed"
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}

function buildChatUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }
  return `${normalized}/chat/completions`;
}

function buildSystemPrompt(settings: Pick<AppSettings, "sourceLanguage" | "targetLanguage" | "targetLanguageCode">) {
  const source = sourceLanguageLabels[settings.sourceLanguage] ?? sourceLanguageLabels.auto;
  const target = targetLanguageLabels[settings.targetLanguageCode] ?? settings.targetLanguage;

  return [
    "\u4f60\u662f\u4e13\u4e1a\u7684\u591a\u8bed\u8a00\u5c4f\u5e55\u7ffb\u8bd1\u52a9\u624b\u3002",
    `\u6e90\u8bed\u8a00\uff1a${source}\u3002`,
    `\u76ee\u6807\u8bed\u8a00\uff1a${target}\u3002`,
    "\u8bf7\u81ea\u52a8\u8bc6\u522b\u8f93\u5165\u5185\u5bb9\u7684\u8bed\u8a00\uff0c\u5e76\u5c06\u5176\u7ffb\u8bd1\u4e3a\u76ee\u6807\u8bed\u8a00\u3002",
    "\u652f\u6301\u82f1\u8bed\u3001\u65e5\u8bed\u3001\u97e9\u8bed\u3001\u6cd5\u8bed\u3001\u5fb7\u8bed\u3001\u897f\u73ed\u7259\u8bed\u3001\u4fc4\u8bed\u3001\u7e41\u4f53\u4e2d\u6587\u7b49\u5e38\u89c1\u8bed\u8a00\u3002",
    "\u4fdd\u7559\u4ee3\u7801\u3001\u547d\u4ee4\u3001\u8def\u5f84\u3001\u53d8\u91cf\u540d\u3001\u5feb\u6377\u952e\u3001\u54c1\u724c\u540d\u3001\u4ea7\u54c1\u540d\u548c\u4e13\u6709\u540d\u8bcd\u3002",
    "UI \u6587\u6848\u8981\u7ffb\u8bd1\u5f97\u7b80\u6d01\u81ea\u7136\uff0c\u4e0d\u8981\u6dfb\u52a0\u989d\u5916\u89e3\u91ca\u3002",
    "\u5982\u679c\u8f93\u5165\u5df2\u7ecf\u662f\u76ee\u6807\u8bed\u8a00\uff0c\u76f4\u63a5\u8fd4\u56de\u539f\u6587\u3002",
    "\u8bf7\u53ea\u8fd4\u56de JSON\uff0c\u683c\u5f0f\u4e3a\uff1a",
    "{\"detected_language\":\"识别到的源语言\",\"source_text\":\"识别到的原文\",\"translated_text\":\"翻译结果\"}"
  ].join("\n");
}

function buildBlockSystemPrompt(settings: Pick<AppSettings, "sourceLanguage" | "targetLanguage" | "targetLanguageCode">) {
  const source = sourceLanguageLabels[settings.sourceLanguage] ?? sourceLanguageLabels.auto;
  const target = targetLanguageLabels[settings.targetLanguageCode] ?? settings.targetLanguage;

  return [
    "\u4f60\u662f\u4e13\u4e1a\u7684\u5c4f\u5e55\u6587\u5b57\u7ffb\u8bd1\u52a9\u624b\u3002",
    `\u6e90\u8bed\u8a00\uff1a${source}\u3002`,
    `\u76ee\u6807\u8bed\u8a00\uff1a${target}\u3002`,
    "\u8f93\u5165\u662f\u4e00\u4e2a JSON \u6570\u7ec4\uff0c\u6bcf\u4e00\u9879\u4ee3\u8868\u622a\u56fe\u4e2d\u7684\u4e00\u4e2a\u6587\u5b57\u5757\u3002",
    "\u8bf7\u81ea\u52a8\u8bc6\u522b\u8f93\u5165\u6587\u5b57\u8bed\u8a00\uff0c\u5e76\u9010\u9879\u7ffb\u8bd1\u4e3a\u76ee\u6807\u8bed\u8a00\u3002",
    "\u4e25\u683c\u4fdd\u6301\u539f id \u4e0d\u53d8\uff0c\u4e0d\u8981\u5408\u5e76\u4e0d\u540c id \u7684\u6587\u672c\uff0c\u4e0d\u8981\u6539\u53d8\u987a\u5e8f\uff0c\u4e0d\u8981\u6dfb\u52a0\u89e3\u91ca\u3002",
    "\u4fdd\u7559\u4ee3\u7801\u3001\u5feb\u6377\u952e\u3001\u8def\u5f84\u3001\u54c1\u724c\u540d\u3001\u53d8\u91cf\u540d\u548c\u4e13\u6709\u540d\u8bcd\u3002",
    "\u8bf7\u53ea\u8fd4\u56de JSON \u6570\u7ec4\uff0c\u683c\u5f0f\u5982\uff1a",
    "[{\"id\":\"block_1\",\"translatedText\":\"缈昏瘧缁撴灉\"}]"
  ].join("\n");
}

function buildFormatSystemPrompt(settings: Pick<AppSettings, "targetLanguage" | "targetLanguageCode">) {
  const target = targetLanguageLabels[settings.targetLanguageCode] ?? settings.targetLanguage;

  return [
    "\u4f60\u662f\u4e13\u4e1a\u7684\u5c4f\u5e55\u7ffb\u8bd1\u6392\u7248\u52a9\u624b\u3002",
    `\u76ee\u6807\u8bed\u8a00\uff1a${target}\u3002`,
    "\u8f93\u5165\u662f OCR \u6587\u5b57\u5757\u7ffb\u8bd1\u540e\u7684 JSON \u6570\u7ec4\uff0c\u6bcf\u9879\u5305\u542b\u539f\u6587\u3001\u8bd1\u6587\u548c\u5750\u6807\u3002",
    "\u8bf7\u6839\u636e\u5750\u6807\u987a\u5e8f\u548c\u6587\u4e49\uff0c\u5c06\u8bd1\u6587\u91cd\u65b0\u7ec4\u7ec7\u6210\u6b63\u5e38\u3001\u6613\u8bfb\u7684\u6392\u7248\u3002",
    "\u8981\u6c42\uff1a",
    "1. \u4fdd\u7559\u539f\u5185\u5bb9\u7684\u6807\u9898\u3001\u6bb5\u843d\u3001\u5217\u8868\u3001\u6b65\u9aa4\u3001\u4ee3\u7801\u3001\u547d\u4ee4\u3001\u5feb\u6377\u952e\u548c UI \u6587\u6848\u7684\u7ed3\u6784\u3002",
    "2. \u4e0d\u8981\u6dfb\u52a0\u539f\u6587\u6ca1\u6709\u7684\u89e3\u91ca\u3001\u603b\u7ed3\u6216\u6807\u9898\u3002",
    "3. \u4e0d\u8981\u8f93\u51fa JSON\u3001Markdown \u4ee3\u7801\u5757\u6216\u989d\u5916\u8bf4\u660e\u3002",
    "4. \u5982\u679c\u5185\u5bb9\u662f\u83dc\u5355\u6216\u6309\u94ae\uff0c\u6309\u884c\u6216\u7b80\u77ed\u5217\u8868\u6392\u7248\u3002",
    "5. \u5982\u679c\u5185\u5bb9\u662f\u6587\u6863\u6bb5\u843d\uff0c\u6309\u81ea\u7136\u6bb5\u843d\u6392\u7248\u3002",
    "\u53ea\u8fd4\u56de\u91cd\u65b0\u6392\u7248\u540e\u7684\u8bd1\u6587\u3002"
  ].join("\n");
}

function parseTranslationResult(raw: string): TranslationResult {
  const trimmed = raw.trim();
  const jsonText = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed;

  try {
    const parsed = JSON.parse(jsonText) as Partial<TranslationResult>;
    return {
      detected_language: parsed.detected_language ?? "",
      source_text: parsed.source_text ?? "",
      translated_text: parsed.translated_text ?? trimmed
    };
  } catch {
    return {
      detected_language: "",
      source_text: "",
      translated_text: trimmed
    };
  }
}

function parseBlockTranslationResult(raw: string): BlockTranslationResult[] {
  const trimmed = raw.trim();
  const jsonText = trimmed.match(/\[[\s\S]*\]/)?.[0] ?? trimmed;

  try {
    const parsed = JSON.parse(jsonText) as Array<Partial<BlockTranslationResult>>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        id: String(item.id ?? ""),
        translatedText: String(item.translatedText ?? "")
      }))
      .filter((item) => item.id);
  } catch {
    return [];
  }
}

async function requestChatCompletion(
  messages: Array<{ role: "system" | "user"; content: string }>,
  settings: Pick<AppSettings, "apiKey" | "baseUrl" | "model">,
  callbacks?: StreamCallbacks
) {
  const response = await fetch(buildChatUrl(settings.baseUrl), {
    method: "POST",
    signal: callbacks?.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      stream: true,
      messages
    })
  });

  if (!response.ok || !response.body) {
    const message = await response.text();
    throw new Error(message || "\u7ffb\u8bd1\u8bf7\u6c42\u5931\u8d25");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let translated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
        };
        const delta = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? "";
        if (!delta) continue;
        translated += delta;
      } catch {
        continue;
      }
    }
  }

  return translated;
}

export async function translateToChinese(
  input: string,
  settings: Pick<AppSettings, "apiKey" | "baseUrl" | "model" | "sourceLanguage" | "targetLanguage" | "targetLanguageCode">,
  callbacks?: StreamCallbacks
) {
  const translated = await requestChatCompletion(
    [
      {
        role: "system",
        content: buildSystemPrompt(settings)
      },
      {
        role: "user",
        content: input
      }
    ],
    settings,
    callbacks
  );

  const result = parseTranslationResult(translated);
  callbacks?.onDelta?.(result.translated_text);
  return result;
}

export async function translateBlocksToChinese(
  blocks: OcrBlock[],
  settings: Pick<AppSettings, "apiKey" | "baseUrl" | "model" | "sourceLanguage" | "targetLanguage" | "targetLanguageCode">,
  callbacks?: StreamCallbacks
): Promise<TranslationBlock[]> {
  const inputBlocks = blocks
    .filter((block) => block.text.trim())
    .map((block) => ({
      id: block.id,
      text: block.text.trim()
    }));

  if (!inputBlocks.length) return [];

  const raw = await requestChatCompletion(
    [
      {
        role: "system",
        content: buildBlockSystemPrompt(settings)
      },
      {
        role: "user",
        content: JSON.stringify(inputBlocks)
      }
    ],
    settings,
    callbacks
  );
  const translatedItems = parseBlockTranslationResult(raw);
  const translatedById = new Map(translatedItems.map((item) => [item.id, item.translatedText]));

  return blocks.map((block) => ({
    id: block.id,
    sourceText: block.text,
    translatedText: translatedById.get(block.id) || "",
    box: block.box,
    confidence: block.confidence
  }));
}

export async function formatTranslatedBlocks(
  blocks: TranslationBlock[],
  settings: Pick<AppSettings, "apiKey" | "baseUrl" | "model" | "targetLanguage" | "targetLanguageCode">,
  callbacks?: StreamCallbacks
) {
  const input = blocks
    .filter((block) => (block.translatedText || block.sourceText).trim())
    .map((block) => ({
      id: block.id,
      sourceText: block.sourceText.trim(),
      translatedText: block.translatedText.trim(),
      box: block.box
    }));

  if (!input.length) return "";

  const raw = await requestChatCompletion(
    [
      {
        role: "system",
        content: buildFormatSystemPrompt(settings)
      },
      {
        role: "user",
        content: JSON.stringify(input)
      }
    ],
    settings,
    callbacks
  );

  return raw
    .trim()
    .replace(/^```(?:text|markdown)?/i, "")
    .replace(/```$/i, "")
    .trim();
}
