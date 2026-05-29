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
