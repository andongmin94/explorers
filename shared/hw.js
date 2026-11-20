// Small DOM helpers for the hardware kit.

/** Keep a .hw-slider's accent fill in step with its value. */
export function syncSlider(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value);
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  input.style.setProperty("--fill", `${fill}%`);
}

/** Bind every .hw-slider under root, now and on input. */
export function bindSliders(root = document) {
  for (const input of root.querySelectorAll("input.hw-slider")) {
    syncSlider(input);
    if (!input.dataset.hwBound) {
      input.addEventListener("input", () => syncSlider(input));
      input.dataset.hwBound = "1";
    }
  }
}

/** Shared icon set (24×24 stroke icons) for keys. */
export const icons = {
  play: '<path d="m8 5 11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  next: '<path d="m9 5 7 7-7 7"/>',
  reset: '<path d="M6 5v14M19 5l-10 7 10 7z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
  compare: '<path d="M4 4v16h16M8 15v-4m5 4V7m5 8v-6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  replay: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
};
export const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] ?? ""}</svg>`;
