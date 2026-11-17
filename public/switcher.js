import { explorers } from "./explorers.js";

const drawings = {
  protocol: '<rect x="8" y="2" width="8" height="5" rx="1"/><path d="M12 7v5M5 16v-4h14v4"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/><rect x="9" y="9" width="6" height="6"/>',
  memory: '<path d="M2 6h20v11H2zM5 17v3m3-3v3m3-3v3m4-3v3m3-3v3"/><path d="M5 9h5v5H5zm9 0h5v5h-5z"/>',
  transaction: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v13c0 4 16 4 16 0V5M4 11.5c0 4 16 4 16 0"/>',
  disk: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="11" cy="11" r="5"/><path d="m17 17-5-5m4 5h1v-1"/>',
  git: '<circle cx="7" cy="5" r="2.5"/><circle cx="7" cy="19" r="2.5"/><circle cx="18" cy="7" r="2.5"/><path d="M7 7.5v9M18 9.5c0 5-11 2-11 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
};

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = drawings[name];
  return svg;
}

function mountSwitcher() {
  const slug = location.pathname.split("/")[1];
  const current = explorers.find((explorer) => explorer.slug === slug);
  const heading = document.querySelector("header h1");
  if (!current || !heading) return;

  const menu = document.createElement("nav");
  menu.className = "explorer-menu";
  menu.id = "explorer-menu";
  menu.popover = "auto";
  menu.setAttribute("aria-label", "탐색기 목록");
  const links = explorers.map((explorer) => {
    const link = document.createElement("a");
    link.href = `/${explorer.slug}/`;
    link.append(icon(explorer.slug), explorer.label);
    if (explorer.slug === slug) {
      link.setAttribute("aria-current", "page");
      link.href = location.href;
      link.append(icon("check"));
    }
    menu.append(link);
    return link;
  });

  const trigger = document.createElement("button");
  trigger.className = "explorer-trigger";
  trigger.type = "button";
  trigger.setAttribute("aria-label", `탐색기 선택, 현재 ${current.label}`);
  trigger.setAttribute("aria-controls", menu.id);
  const titleGroup = heading.parentElement;
  const face = document.createElement("span");
  face.className = "explorer-brand-face";
  const mark = document.createElement("span");
  mark.className = "explorer-brand-mark";
  mark.append(icon(slug));
  const name = document.createElement("span");
  name.className = "explorer-brand-name";
  name.textContent = current.label;
  const caption = document.createElement("span");
  caption.className = "explorer-brand-caption";
  caption.id = "explorer-caption";
  caption.textContent = titleGroup.querySelector("p").textContent;
  const chevron = icon("chevron");
  chevron.classList.add("explorer-chevron");
  const copy = document.createElement("span");
  copy.className = "explorer-brand-copy";
  copy.append(name, chevron, caption);
  face.append(mark, copy);
  trigger.append(face);
  trigger.setAttribute("aria-describedby", caption.id);
  heading.closest("header").querySelector(".brand-icon, .logo-frame").remove();
  titleGroup.replaceWith(heading);
  heading.classList.add("explorer-brand");
  heading.setAttribute("aria-label", current.label);
  document.body.append(menu);
  heading.replaceChildren(trigger);
  trigger.popoverTargetElement = menu;

  function placeMenu() {
    const rect = trigger.getBoundingClientRect();
    menu.style.setProperty("--trigger-left", `${rect.left}px`);
    menu.style.setProperty("--trigger-bottom", `${rect.bottom}px`);
  }
  menu.addEventListener("beforetoggle", (event) => {
    const open = event.newState === "open";
    if (open) placeMenu();
    trigger.setAttribute("aria-expanded", String(open));
  });
  trigger.setAttribute("aria-expanded", "false");
  const stop = (event) => event.stopPropagation();
  // The lessons also listen for playback shortcuts on key release.
  for (const element of [trigger, menu]) element.addEventListener("keyup", stop);
  trigger.addEventListener("keydown", (event) => {
    stop(event);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      menu.showPopover();
      links[event.key === "ArrowDown" ? 0 : links.length - 1].focus();
    }
  });
  menu.addEventListener("keydown", (event) => {
    stop(event);
    const index = links.indexOf(document.activeElement);
    const positions = {
      ArrowDown: (index + 1) % links.length,
      ArrowUp: (index + links.length - 1) % links.length,
      Home: 0,
      End: links.length - 1,
    };
    if (Object.hasOwn(positions, event.key)) {
      event.preventDefault();
      links[positions[event.key]].focus();
    }
  });
  menu.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    if (link.hasAttribute("aria-current") && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      trigger.focus();
    }
    menu.hidePopover();
  });
  document.addEventListener("focusin", (event) => {
    if (menu.matches(":popover-open") && event.target !== trigger && !menu.contains(event.target)) menu.hidePopover();
  });
  window.addEventListener("resize", () => {
    if (menu.matches(":popover-open")) placeMenu();
  });
  window.addEventListener("scroll", () => {
    if (menu.matches(":popover-open")) menu.hidePopover();
  });
}

document.addEventListener("DOMContentLoaded", mountSwitcher, { once: true });
