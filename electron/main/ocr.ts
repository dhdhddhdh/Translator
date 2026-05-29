import { app } from "electron";
import { execFile } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import Tesseract from "tesseract.js";
import type { OcrBlock, OcrEngine, OcrResult, TranslationCanvas } from "./types";

const execFileAsync = promisify(execFile);
let workerPromise: Promise<Tesseract.Worker> | null = null;
const activeOcrProcesses = new Set<ChildProcess>();
const TESSERACT_LANGUAGES = "eng+jpn+kor+chi_sim+chi_tra+fra+deu+spa+rus";

function getAppRootPath() {
  return app.isPackaged ? path.join(process.resourcesPath, "app.asar.unpacked") : app.getAppPath();
}

function getTesseractPaths() {
  const root = getAppRootPath();
  return {
    workerPath: path.join(root, "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js"),
    corePath: path.join(root, "node_modules", "tesseract.js-core", "tesseract-core-lstm.wasm.js")
  };
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { workerPath, corePath } = getTesseractPaths();
      return Tesseract.createWorker(TESSERACT_LANGUAGES, 1, {
        workerPath,
        corePath
      });
    })();
  }
  return workerPromise;
}

async function recognizeWithTesseract(imageBuffer: Buffer): Promise<OcrResult> {
  const worker = await getWorker();
  const result = await worker.recognize(imageBuffer);
  const data = result.data as typeof result.data & {
    lines?: Array<{
      text?: string;
      confidence?: number;
      bbox?: { x0: number; y0: number; x1: number; y1: number };
    }>;
  };
  const blocks = normalizeTesseractBlocks(data.lines ?? []);

  return {
    text: result.data.text.trim(),
    blocks,
    canvas: inferCanvasFromBlocks(blocks),
    engine: "tesseract"
  };
}

function normalizeTesseractBlocks(
  lines: Array<{ text?: string; confidence?: number; bbox?: { x0: number; y0: number; x1: number; y1: number } }>
): OcrBlock[] {
  const blocks: OcrBlock[] = [];

  for (const [index, line] of lines.entries()) {
    const text = (line.text ?? "").trim();
    const bbox = line.bbox;
    if (!text) continue;

    const block: OcrBlock = {
      id: `line_${index}`,
      text,
      confidence: line.confidence,
      lineIndex: index,
      blockIndex: index
    };

    if (bbox) {
      block.box = {
        x: Math.max(0, bbox.x0),
        y: Math.max(0, bbox.y0),
        width: Math.max(1, bbox.x1 - bbox.x0),
        height: Math.max(1, bbox.y1 - bbox.y0)
      };
    }

    blocks.push(block);
  }

  return blocks;
}

function inferCanvasFromBlocks(blocks: OcrBlock[]): TranslationCanvas | undefined {
  const boxed = blocks.filter((block) => block.box);
  if (!boxed.length) return undefined;

  return {
    width: Math.ceil(Math.max(...boxed.map((block) => (block.box?.x ?? 0) + (block.box?.width ?? 0)))),
    height: Math.ceil(Math.max(...boxed.map((block) => (block.box?.y ?? 0) + (block.box?.height ?? 0))))
  };
}

function getWindowsOcrScriptPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "resources", "windows-ocr.ps1");
  }
  return path.resolve(app.getAppPath(), "resources", "windows-ocr.ps1");
}

async function recognizeWithWindowsOcr(imageBuffer: Buffer): Promise<OcrResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "screen-translator-"));
  const imagePath = path.join(tempDir, "capture.png");

  try {
    await fs.writeFile(imagePath, imageBuffer);
    const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = execFile(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          getWindowsOcrScriptPath(),
          imagePath
        ],
        {
          windowsHide: true,
          maxBuffer: 8 * 1024 * 1024
        },
        (error, stdout, stderr) => {
          activeOcrProcesses.delete(child);
          if (error) {
            reject(error);
            return;
          }
          resolve({ stdout, stderr });
        }
      );
      activeOcrProcesses.add(child);
    });

    if (stderr?.trim()) {
      throw new Error(stderr.trim());
    }

    const parsed = parseWindowsOcrOutput(stdout);
    return {
      ...parsed,
      engine: "windows"
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function parseWindowsOcrOutput(stdout: string): Omit<OcrResult, "engine"> {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return { text: "", blocks: [] };
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      text?: string;
      blocks?: OcrBlock[];
      canvas?: TranslationCanvas;
    };
    const blocks = normalizeOcrBlocks(parsed.blocks ?? []);
    return {
      text: (parsed.text ?? blocks.map((block) => block.text).join("\n")).trim(),
      blocks,
      canvas: parsed.canvas
    };
  } catch {
    const blocks = trimmed
      .split(/\r?\n/)
      .map((line, index) => line.trim())
      .filter(Boolean)
      .map((line, index) => ({
        id: `line_${index}`,
        text: line,
        lineIndex: index,
        blockIndex: index
      }));
    return {
      text: trimmed,
      blocks
    };
  }
}

function normalizeOcrBlocks(blocks: OcrBlock[]) {
  return blocks
    .map((block, index) => ({
      ...block,
      id: block.id || `line_${index}`,
      text: (block.text ?? "").trim(),
      lineIndex: block.lineIndex ?? index,
      blockIndex: block.blockIndex ?? index
    }))
    .filter((block) => block.text);
}

export async function recognizeTextFromBuffer(imageBuffer: Buffer, preferredEngine: OcrEngine): Promise<OcrResult> {
  if (preferredEngine === "windows") {
    return recognizeWithWindowsOcr(imageBuffer);
  }

  if (preferredEngine === "tesseract") {
    return recognizeWithTesseract(imageBuffer);
  }

  try {
    const windowsResult = await recognizeWithWindowsOcr(imageBuffer);
    if (windowsResult.text) {
      return windowsResult;
    }
  } catch {
    // Ignore and fall back to Tesseract below.
  }

  return recognizeWithTesseract(imageBuffer);
}

export async function shutdownOcr() {
  for (const child of activeOcrProcesses) {
    child.kill();
  }
  activeOcrProcesses.clear();

  if (workerPromise) {
    const worker = await workerPromise.catch(() => null);
    if (worker) {
      await worker.terminate().catch(() => undefined);
    }
    workerPromise = null;
  }
}
