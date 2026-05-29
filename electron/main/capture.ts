import { desktopCapturer, screen } from "electron";
import type { SelectionBounds } from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export async function captureSelection(selection: SelectionBounds) {
  const targetDisplay = screen.getAllDisplays().find((display) => display.id === selection.displayId);
  if (!targetDisplay) {
    throw new Error("\u65e0\u6cd5\u5b9a\u4f4d\u6240\u9009\u5c4f\u5e55");
  }

  const scaleFactor = selection.scaleFactor || targetDisplay.scaleFactor || 1;
  const thumbnailSize = {
    width: Math.max(1, Math.round(targetDisplay.bounds.width * scaleFactor)),
    height: Math.max(1, Math.round(targetDisplay.bounds.height * scaleFactor))
  };

  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize
  });

  const source = sources.find((item) => item.display_id === String(targetDisplay.id)) ?? sources[0];
  if (!source) {
    throw new Error("\u65e0\u6cd5\u83b7\u53d6\u5c4f\u5e55\u622a\u56fe");
  }

  const image = source.thumbnail;
  const cropRect = {
    x: clamp(Math.round((selection.x - targetDisplay.bounds.x) * scaleFactor), 0, thumbnailSize.width - 1),
    y: clamp(Math.round((selection.y - targetDisplay.bounds.y) * scaleFactor), 0, thumbnailSize.height - 1),
    width: 1,
    height: 1
  };

  cropRect.width = clamp(Math.round(selection.width * scaleFactor), 1, thumbnailSize.width - cropRect.x);
  cropRect.height = clamp(Math.round(selection.height * scaleFactor), 1, thumbnailSize.height - cropRect.y);

  return image.crop(cropRect).toPNG();
}
