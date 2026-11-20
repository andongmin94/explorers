// Liquid Glass refraction for the web (port of shared/glass.js). Glass parts
// blur and saturate what is behind them everywhere; in Chromium, which accepts
// an SVG filter in backdrop-filter, they also bend the backdrop near their
// edges like a thick lens. mountGlass() adds the two SVG filters once and
// marks <html> with data-lens="on" so app.css switches them on. Everything
// else (Safari, Firefox, reduced transparency, increased contrast) keeps the
// plain blur.
//
// The displacement map is drawn per element (objectBoundingBox units): red
// rises toward the left edge and falls toward the right one, green likewise
// top/bottom, neutral grey in the middle, so only a band along the rim moves.

const NS = "http://www.w3.org/2000/svg";

/** A data-URI ramp: `axis` "x" or "y", channel colour at the near and far edge. */
function ramp(axis: "x" | "y", band: number) {
  const [x2, y2] = axis === "x" ? [1, 0] : [0, 1];
  const hi = axis === "x" ? "#ff0000" : "#00ff00";
  const mid = axis === "x" ? "#800000" : "#008000";
  const lo = "#000000";
  const svg = `<svg xmlns="${NS}" viewBox="0 0 1 1" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${hi}"/><stop offset="${band}" stop-color="${mid}"/><stop offset="${1 - band}" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient></defs><rect width="1" height="1" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function filter(id: string, band: number, scale: number) {
  return `<filter id="${id}" x="0" y="0" width="1" height="1" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
    <feImage href="${ramp("x", band)}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="rx"/>
    <feImage href="${ramp("y", band)}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="ry"/>
    <feComposite in="rx" in2="ry" operator="arithmetic" k2="1" k3="1" result="map"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/>
  </filter>`;
}

interface UADataNavigator extends Navigator {
  userAgentData?: { brands?: { brand: string }[] };
}

function lensSupported() {
  if (typeof CSS === "undefined" || !CSS.supports?.("backdrop-filter", "url(#a) blur(1px)"))
    return false;
  // Safari parses url() in backdrop-filter but renders nothing; only Chromium draws it.
  const brands = (navigator as UADataNavigator).userAgentData?.brands ?? [];
  return brands.some((b) => /Chromium/.test(b.brand));
}

/** Add #lg-lens / #lg-lens-sm once and set data-lens="on" where it renders. */
export function mountGlass(doc: Document = document) {
  if (doc.getElementById("lg-filters")) return;
  const holder = doc.createElementNS(NS, "svg");
  holder.id = "lg-filters";
  holder.setAttribute("aria-hidden", "true");
  holder.setAttribute("width", "0");
  holder.setAttribute("height", "0");
  holder.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  holder.innerHTML = `<defs>${filter("lg-lens", 0.09, 0.05)}${filter("lg-lens-sm", 0.22, 0.12)}</defs>`;
  doc.body.prepend(holder);
  if (lensSupported()) doc.documentElement.dataset.lens = "on";
}
