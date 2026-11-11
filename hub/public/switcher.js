import { explorers } from "./explorers.js";

function mountSwitcher() {
  const slug = window.location.pathname.split("/")[1];
  const current = explorers.find((explorer) => explorer.slug === slug);
  const heading = document.querySelector("header h1");
  if (!current || !heading) return;

  const control = document.createElement("div");
  control.className = "explorer-switcher";

  const select = document.createElement("select");
  select.setAttribute("aria-label", "탐험가 선택");
  select.title = "다른 탐험가로 이동";
  for (const explorer of explorers) {
    const selected = explorer.slug === slug;
    select.add(new Option(explorer.label, explorer.slug, selected, selected));
  }
  select.addEventListener("change", () => {
    const destination = select.value;
    // Keep the selection in sync with this page if it returns from the back cache.
    select.value = slug;
    window.location.assign(`/${destination}/`);
  });

  const arrow = document.createElement("span");
  arrow.className = "explorer-switcher-arrow";
  arrow.setAttribute("aria-hidden", "true");
  heading.before(control);
  heading.textContent = current.label;
  control.append(heading, arrow, select);
}

document.addEventListener("DOMContentLoaded", mountSwitcher, { once: true });
