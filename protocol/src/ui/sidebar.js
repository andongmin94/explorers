// Reconstructed from the distributed Protocol Explorer JavaScript.
import { protocolCatalog } from "../lessons/index.js";
import { icons } from "./icons.js";
import { getLessonStatus } from "../progress.js";
import {
  EASE_OUT_EXPO,
  prefersReducedMotion,
  smoothScrollTo,
} from "./motion.js";
import { translate, translatedElementContent } from "../i18n.js";
const PROTOCOL_FILTERS = [
  ["all", "ALL"],
  ["core", "CORE"],
  ["application", "APPLICATION"],
  ["security", "SECURITY"],
];

function renderLessonSteps(lesson) {
  return `<div class="steps-wrap"><div class="steps-clip"><ol class="steps">${lesson.steps
    .map(
      (step, index) => `
      <li class="step" data-step="${index}" style="--i:${index}">
        <button class="step-btn" type="button">
          <span class="step-num"><span>${index + 1}</span>${icons.check.replace("<path", '<path pathLength="1"')}</span>
          <span class="step-text">
            <span class="step-title" ${translatedElementContent(step.title, true)}</span>
            <span class="step-desc" ${translatedElementContent(step.desc)}</span>
          </span>
        </button>
      </li>`,
    )
    .join("")}</ol></div></div>`;
}

function renderSidebar(lessons) {
  const protocolRows = protocolCatalog
    .map((protocol) => {
      const lesson = lessons[protocol.id];
      return `
      <li class="proto ${lesson ? "has-lesson" : ""}" data-group="${protocol.group}" ${lesson ? `data-lesson="${protocol.id}"` : ""}>
        <button class="proto-row" type="button" aria-expanded="false">
          <span class="status-dot ${getLessonStatus(lesson)}" data-status="${getLessonStatus(lesson)}"></span>
          <span class="proto-text">
            <span class="proto-name">${protocol.name}</span>
            <span class="proto-full" ${translatedElementContent(protocol.full)}</span>
          </span>
          <span class="proto-chev">${icons.chevron}</span>
        </button>
        ${lesson ? renderLessonSteps(lesson) : ""}
      </li>`;
    })
    .join("");
  const filterTabs = PROTOCOL_FILTERS.map(([group, label], index) => {
    const count =
      group === "all"
        ? protocolCatalog.length
        : protocolCatalog.filter((protocol) => protocol.group === group).length;
    return `<button class="tab ${index === 0 ? "is-active" : ""}" type="button" role="tab" aria-selected="${index === 0}" data-group="${group}">
      <span ${translatedElementContent(label)}</span><span class="tab-count">${count}</span>
    </button>`;
  }).join("");
  return `
  <aside class="panel sidebar" id="protocols">
    <div class="panel-head">
      <h2 class="panel-title" ${translatedElementContent("INTERNET PROTOCOLS")}</h2>
      <button class="more" type="button" data-t-label="More" aria-label="${translate("More")}">${icons.dots}</button>
      <button class="drawer-close" type="button" data-t-label="Close the protocol list" aria-label="${translate("Close the protocol list")}" data-t-title="Close (Esc)" title="${translate("Close (Esc)")}">${icons.close}</button>
    </div>
    <div class="tabs" role="tablist">${filterTabs}<span class="tab-indicator"></span></div>
    <ul class="proto-list">${protocolRows}</ul>
  </aside>`;
}

function positionFilterIndicator(sidebar) {
  const activeTab = sidebar.querySelector(".tab.is-active");
  const indicator = sidebar.querySelector(".tab-indicator");
  indicator.style.left = `${activeTab.offsetLeft}px`;
  indicator.style.width = `${activeTab.offsetWidth}px`;
}
const FILTER_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
const getElementScale = (element) =>
  element.getBoundingClientRect().height / element.offsetHeight || 1;

function animateRemovedProtocol(
  list,
  row,
  { rect: previousRect, opacity },
  scale,
) {
  const listRect = list.getBoundingClientRect();
  const ghost = row.cloneNode(true);
  ghost.classList.add("proto-ghost");
  ghost.removeAttribute("data-lesson");
  ghost.dataset.ghostOf = row.querySelector(".proto-name").textContent;
  Object.assign(ghost.style, {
    top: `${(previousRect.top - listRect.top) / scale + list.scrollTop}px`,
    left: `${(previousRect.left - listRect.left) / scale}px`,
    width: `${row.offsetWidth}px`,
  });
  list.appendChild(ghost);
  ghost.animate(
    [
      {
        opacity,
      },
      {
        opacity: 0,
      },
    ],
    {
      duration: 60 + 110 * opacity,
      easing: "ease-in",
      fill: "forwards",
    },
  ).onfinish = () => ghost.remove();
}

function filterProtocols(sidebar, group) {
  // Measure before hiding rows, then animate each survivor from its old position.
  const list = sidebar.querySelector(".proto-list");
  const rows = [...list.querySelectorAll(":scope > .proto:not(.proto-ghost)")];
  const scale = getElementScale(list);
  const reducedMotion = prefersReducedMotion();
  const previousPositions = new Map();
  for (const row of rows) {
    if (row.hidden) {
      continue;
    }
    const rect = row.getBoundingClientRect();
    previousPositions.set(row, {
      rect,
      top: rect.top,
      opacity: Number(getComputedStyle(row).opacity),
      moving: row.getAnimations().length > 0,
    });
  }
  let removedCount = 0;
  for (const row of rows) {
    if (
      !(group === "all" || row.dataset.group === group) &&
      !row.hidden &&
      !reducedMotion
    ) {
      animateRemovedProtocol(list, row, previousPositions.get(row), scale);
      removedCount++;
    }
  }
  for (const row of rows) {
    row.getAnimations().forEach((animation) => animation.cancel());
    row.hidden = !(group === "all" || row.dataset.group === group);
  }
  if (reducedMotion) {
    return;
  }
  const movementRanges = [];
  for (const row of rows) {
    const previous = previousPositions.get(row);
    if (row.hidden || !previous) {
      continue;
    }
    const nextRect = row.getBoundingClientRect();
    movementRanges.push([
      Math.min(previous.top, nextRect.top),
      Math.max(previous.top, nextRect.top) + nextRect.height,
    ]);
  }
  let enteringIndex = 0;
  for (const row of rows) {
    if (row.hidden) {
      continue;
    }
    const previous = previousPositions.get(row);
    if (previous) {
      const offsetY = (previous.top - row.getBoundingClientRect().top) / scale;
      if (Math.abs(offsetY) < 0.5 && previous.opacity >= 1) {
        continue;
      }
      row.animate(
        [
          {
            transform: `translateY(${offsetY}px)`,
            opacity: previous.opacity,
          },
          {
            transform: "none",
            opacity: 1,
          },
        ],
        {
          duration: 360,
          delay: previous.moving || !removedCount ? 0 : 90,
          easing: FILTER_EASING,
          fill: "backwards",
        },
      );
    } else {
      const nextRect = row.getBoundingClientRect();
      const crossesMovingRow = movementRanges.some(
        ([top, bottom]) =>
          top < nextRect.bottom - 4 &&
          bottom > nextRect.top + 4 &&
          bottom - top > nextRect.height + 8,
      );
      row.animate(
        [
          {
            opacity: 0,
            transform: "translateY(8px)",
          },
          {
            opacity: 1,
            transform: "none",
          },
        ],
        {
          duration: 300,
          delay:
            (crossesMovingRow ? 250 : removedCount ? 150 : 70) +
            enteringIndex++ * 22,
          easing: EASE_OUT_EXPO,
          fill: "backwards",
        },
      );
    }
  }
}

function bindSidebar(sidebar, { onStep, onSelect }) {
  positionFilterIndicator(sidebar);
  const resizeObserver = new ResizeObserver(() =>
    positionFilterIndicator(sidebar),
  );
  sidebar
    .querySelectorAll(".tabs, .tab")
    .forEach((tab) => resizeObserver.observe(tab));
  document.fonts.ready.then(() => {
    positionFilterIndicator(sidebar);
    sidebar.querySelector(".tabs").classList.add("is-ready");
  });
  sidebar.addEventListener("click", (event) => {
    const stepButton = event.target.closest(".proto.is-open .step-btn");
    if (stepButton) {
      onStep(Number(stepButton.parentElement.dataset.step));
    }
    const protocolButton = event.target.closest(
      ".proto.has-lesson > .proto-row",
    );
    if (protocolButton) {
      onSelect(protocolButton.parentElement.dataset.lesson);
    }
    const selectedTab = event.target.closest(".tab");
    if (selectedTab && !selectedTab.classList.contains("is-active")) {
      sidebar.querySelectorAll(".tab").forEach((tab) => {
        tab.classList.toggle("is-active", tab === selectedTab);
        tab.setAttribute("aria-selected", tab === selectedTab);
      });
      positionFilterIndicator(sidebar);
      filterProtocols(sidebar, selectedTab.dataset.group);
    }
  });
}

function setSidebarLesson(sidebar, lessonId) {
  const isFirstRender = !sidebar.dataset.lesson;
  sidebar.dataset.lesson = lessonId;
  for (const row of sidebar.querySelectorAll(".proto.has-lesson")) {
    const selected = row.dataset.lesson === lessonId;
    if (selected !== row.classList.contains("is-open")) {
      if (selected) {
        row.classList.add("instant");
        row.querySelectorAll(".step").forEach((step) => {
          step.classList.remove("is-active", "is-done");
          step.style.removeProperty("--delay");
        });
        // Flush the reset styles before enabling step transitions again.
        row.offsetWidth;
        row.classList.remove("instant");
      }
      row.classList.toggle("is-active", selected);
      row.classList.toggle("is-open", selected);
      row.querySelector(".proto-row").setAttribute("aria-expanded", selected);
    }
  }
  const selectedRow = sidebar.querySelector(
    `.proto[data-lesson="${lessonId}"]`,
  );
  if (!isFirstRender) {
    setTimeout(
      () =>
        sidebar.dataset.lesson === lessonId &&
        scrollProtocolIntoView(
          sidebar.querySelector(".proto-list"),
          selectedRow,
        ),
      460,
    );
  }
}

function scrollProtocolIntoView(list, row) {
  const scale = getElementScale(list);
  const listRect = list.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const rowTop = (rowRect.top - listRect.top) / scale + list.scrollTop;
  const rowHeight = rowRect.height / scale;
  const viewportHeight = list.clientHeight;
  const padding = 8;
  if (
    rowHeight + 2 * padding > viewportHeight ||
    rowTop < list.scrollTop + padding
  ) {
    smoothScrollTo(list, rowTop - padding);
  } else if (rowTop + rowHeight > list.scrollTop + viewportHeight - padding) {
    smoothScrollTo(list, rowTop + rowHeight - viewportHeight + padding);
  }
}

function updateSidebarProgress(sidebar, lessons) {
  sidebar.querySelectorAll(".proto[data-lesson]").forEach((row) => {
    const statusDot = row.querySelector(".status-dot");
    const status = getLessonStatus(lessons[row.dataset.lesson]);
    if (statusDot.dataset.status !== status) {
      statusDot.dataset.status = status;
      statusDot.className = `status-dot ${status}`;
      if (!prefersReducedMotion()) {
        // Restart the status pulse even if the same element was just animated.
        statusDot.offsetWidth;
        statusDot.classList.add("is-changed");
      }
    }
  });
}

function updateSidebar(sidebar, playback, lesson) {
  if (sidebar.dataset.lesson !== lesson.id) {
    setSidebarLesson(sidebar, lesson.id);
  }
  const steps = [
    ...sidebar.querySelectorAll(`.proto[data-lesson="${lesson.id}"] .step`),
  ];
  const completedSteps = steps.filter(
    (step, index) =>
      playback.steps[index] === "done" && !step.classList.contains("is-done"),
  );
  const reopenedSteps = steps
    .filter(
      (step, index) =>
        playback.steps[index] !== "done" && step.classList.contains("is-done"),
    )
    .reverse();
  steps.forEach((step) => step.style.setProperty("--delay", "0ms"));
  completedSteps.forEach((step, index) =>
    step.style.setProperty("--delay", `${index * 90}ms`),
  );
  reopenedSteps.forEach((step, index) =>
    step.style.setProperty("--delay", `${index * 50}ms`),
  );
  steps.forEach((step, index) => {
    if (
      playback.steps[index] === "active" &&
      !step.classList.contains("is-active")
    ) {
      step.style.setProperty("--delay", `${completedSteps.length * 90}ms`);
    }
    step.classList.toggle("is-active", playback.steps[index] === "active");
    step.classList.toggle("is-done", playback.steps[index] === "done");
  });
}
export { bindSidebar, renderSidebar, updateSidebar, updateSidebarProgress };
