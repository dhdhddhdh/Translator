import "./styles.css";

const root = document.getElementById("overlay-root");

if (!root) {
  throw new Error("Overlay root not found");
}

root.innerHTML = `
  <div class="overlay">
    <div class="overlay-tip" id="overlay-tip"></div>
    <div class="selection-box" id="selection-box"></div>
  </div>
`;

const overlay = document.querySelector(".overlay") as HTMLDivElement;
const selectionBox = document.getElementById("selection-box") as HTMLDivElement;
const tip = document.getElementById("overlay-tip") as HTMLDivElement;

let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
let dragging = false;
let overlayContext = {
  displayId: 0,
  originX: 0,
  originY: 0,
  scaleFactor: window.devicePixelRatio || 1,
  mode: "single" as "single" | "monitor"
};

window.translatorApi.onOverlayContext((payload) => {
  overlayContext = payload;
  tip.textContent =
    payload.mode === "monitor"
      ? "\u62d6\u62fd\u9009\u62e9\u9700\u8981\u81ea\u52a8\u7ffb\u8bd1\u7684\u533a\u57df\uff0c\u6309 Esc \u53d6\u6d88"
      : "\u62d6\u62fd\u9009\u62e9\u9700\u8981\u7ffb\u8bd1\u7684\u533a\u57df\uff0c\u6309 Esc \u53d6\u6d88";
});

overlay.addEventListener("mousedown", (event) => {
  dragging = true;
  startX = event.clientX;
  startY = event.clientY;
  currentX = event.clientX;
  currentY = event.clientY;
  updateSelection();
});

overlay.addEventListener("mousemove", (event) => {
  if (!dragging) return;
  currentX = event.clientX;
  currentY = event.clientY;
  updateSelection();
});

overlay.addEventListener("mouseup", () => {
  if (!dragging) return;
  dragging = false;

  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  if (width < 8 || height < 8) {
    window.translatorApi.cancelSelection();
    return;
  }

  const screenX = overlayContext.originX + Math.min(startX, currentX);
  const screenY = overlayContext.originY + Math.min(startY, currentY);

  window.translatorApi.confirmSelection({
    x: screenX,
    y: screenY,
    width,
    height,
    displayId: overlayContext.displayId,
    scaleFactor: overlayContext.scaleFactor
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    window.translatorApi.cancelSelection();
  }
});

function updateSelection() {
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  selectionBox.style.left = `${left}px`;
  selectionBox.style.top = `${top}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;
}
