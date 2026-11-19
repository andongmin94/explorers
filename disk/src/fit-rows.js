// Records tables never scroll on the desktop console: show the rows that fit
// the box, around the current row (a little history before it, the rest
// after). Like shared/fit.js rowWindow, but it measures every row and leaves
// the table whole on narrow screens, where the page itself scrolls.
export function followRows(box, { before = 0.4, current = (tbody) => tbody.querySelector('tr[aria-current="true"]') } = {}) {
  const desktop = matchMedia("(min-width: 1100px) and (min-height: 700px)");
  function refresh() {
    const tbody = box.querySelector("tbody");
    if (!tbody) return;
    const rows = [...tbody.rows];
    rows.forEach((r) => (r.hidden = false));
    if (!rows.length || !desktop.matches || !box.clientHeight || box.scrollHeight <= box.clientHeight + 1) return;
    const heights = rows.map((r) => r.getBoundingClientRect().height);
    const total = heights.reduce((a, b) => a + b, 0);
    const room = box.clientHeight - (box.scrollHeight - total) - 2;
    const cur = current(tbody);
    // Before the first event nothing is current: show the table from its top.
    const at = cur && rows.includes(cur) ? rows.indexOf(cur) : 0;
    let start = at;
    let end = at;
    let used = heights[at];
    for (;;) {
      const wantBefore = start > 0 && (at - start < before * (end - start + 2) || end === rows.length - 1);
      const i = wantBefore ? start - 1 : end + 1;
      if (i < 0 || i >= rows.length || used + heights[i] > room) break;
      used += heights[i];
      if (wantBefore) start = i;
      else end = i;
    }
    rows.forEach((r, i) => (r.hidden = i < start || i > end));
    // Safety net for rounding: drop rows from the end farther from the current one.
    while (box.scrollHeight > box.clientHeight + 1 && end > start) {
      if (end - at >= at - start) rows[end--].hidden = true;
      else rows[start++].hidden = true;
    }
  }
  new ResizeObserver(() => requestAnimationFrame(refresh)).observe(box);
  desktop.addEventListener("change", refresh);
  return { refresh };
}
