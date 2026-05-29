import "./styles.css";

const root = document.getElementById("region-root");

if (!root) {
  throw new Error("Region root not found");
}

root.innerHTML = `
  <div class="monitor-region"></div>
`;
