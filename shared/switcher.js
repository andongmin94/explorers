// The explorer switcher in every page header. ui-sdk's menu owns the popup:
// focus, arrow keys, typeahead, Escape and outside clicks. This file only
// builds the markup and swaps it in for the explorer's own title.
import "@ui-sdk/web/menu";
import { explorers } from "./explorers.js";
import "./switcher.css";
// Sizes the console rows on every page (see fit.js).
import "./fit.js";

const drawings = {
  protocol: '<rect x="8" y="2" width="8" height="5" rx="1"/><path d="M12 7v5M5 16v-4h14v4"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/><rect x="9" y="9" width="6" height="6"/>',
  memory: '<path d="M2 6h20v11H2zM5 17v3m3-3v3m3-3v3m4-3v3m3-3v3"/><path d="M5 9h5v5H5zm9 0h5v5h-5z"/>',
  transaction: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v13c0 4 16 4 16 0V5M4 11.5c0 4 16 4 16 0"/>',
  disk: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="11" cy="11" r="5"/><path d="m17 17-5-5m4 5h1v-1"/>',
  git: '<circle cx="7" cy="5" r="2.5"/><circle cx="7" cy="19" r="2.5"/><circle cx="18" cy="7" r="2.5"/><path d="M7 7.5v9M18 9.5c0 5-11 2-11 7"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
};

const icon = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${drawings[name]}</svg>`;

const escape = (text) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function mountSwitcher() {
  const slug = location.pathname.split("/")[1];
  const current = explorers.find((explorer) => explorer.slug === slug);
  const heading = document.querySelector("header h1");
  if (!current || !heading) return;

  const titleGroup = heading.parentElement;
  const caption = titleGroup.querySelector("p")?.textContent ?? "";
  heading.closest("header").querySelector(".brand-icon, .logo-frame")?.remove();
  titleGroup.replaceWith(heading);

  const items = explorers
    .map((explorer, index) => {
      const here = explorer.slug === slug;
      return `<ui-menu-item as-child>
        <a class="explorer-item" href="${here ? location.href : `/${explorer.slug}/`}"${here ? ' aria-current="page"' : ""}>
          <span class="explorer-item-index">${String(index + 1).padStart(2, "0")}</span>
          ${icon(explorer.slug)}
          <span class="explorer-item-label">${escape(explorer.label)}</span>
          <span class="explorer-led" aria-hidden="true"></span>
        </a>
      </ui-menu-item>`;
    })
    .join("");

  heading.classList.add("explorer-brand");
  heading.setAttribute("aria-label", current.label);
  heading.innerHTML = `<ui-menu>
    <ui-menu-trigger>
      <button class="explorer-trigger" type="button" aria-label="탐색기 선택, 현재 ${escape(current.label)}" aria-describedby="explorer-caption">
        <span class="explorer-brand-mark">${icon(slug)}<span class="explorer-led" aria-hidden="true"></span></span>
        <span class="explorer-brand-copy">
          <span class="explorer-brand-name">${escape(current.label)}</span>
          <span class="explorer-brand-caption" id="explorer-caption">${escape(caption)}</span>
        </span>
        <span class="explorer-chevron">${icon("chevron")}</span>
      </button>
    </ui-menu-trigger>
    <ui-menu-content class="explorer-menu" side="bottom" align="start" side-offset="10" collision-padding="12" aria-label="탐색기 목록">
      ${items}
    </ui-menu-content>
  </ui-menu>`;

  // The lessons listen for playback shortcuts on key release; keys used in the
  // switcher must not also play or pause the scene.
  const stop = (event) => event.stopPropagation();
  for (const type of ["keydown", "keyup"]) heading.addEventListener(type, stop);
}

// This module is imported before the explorer's main.js draws its header, and
// module scripts run before DOMContentLoaded, so mount once the page is parsed
// and every entry module has run.
if (document.readyState === "complete") {
  mountSwitcher();
} else {
  document.addEventListener("DOMContentLoaded", mountSwitcher, { once: true });
}
