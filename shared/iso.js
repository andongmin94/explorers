// Lighting for the isometric devices. Every scene paints a device's faces with
// --iso-top-fill, --iso-front-fill and --iso-side-fill, which point at these
// gradients (with a flat colour as fallback). The light comes from the upper
// left: the top face is brightest, the front falls off toward the floor, and
// the side stays in shade. Stop colours read theme variables, so the same
// gradients serve light and dark mode.
const faces = {
  top: { x2: 1, y2: 1 },
  front: { x2: 0, y2: 1 },
  side: { x2: 0, y2: 1 },
};

function injectGradients() {
  if (document.getElementById("hw-iso-defs")) return;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.id = "hw-iso-defs";
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  const defs = document.createElementNS(ns, "defs");
  for (const [face, { x2, y2 }] of Object.entries(faces)) {
    const gradient = document.createElementNS(ns, "linearGradient");
    gradient.id = `hw-iso-${face}`;
    gradient.setAttribute("x1", "0");
    gradient.setAttribute("y1", "0");
    gradient.setAttribute("x2", String(x2));
    gradient.setAttribute("y2", String(y2));
    for (const [offset, tone] of [["0", "hi"], ["1", "lo"]]) {
      const stop = document.createElementNS(ns, "stop");
      stop.setAttribute("offset", offset);
      stop.setAttribute("style", `stop-color: var(--iso-${face}-${tone})`);
      gradient.append(stop);
    }
    defs.append(gradient);
  }
  // Wall falloff: the lower part of every solid darkens toward the floor.
  const shade = document.createElementNS(ns, "linearGradient");
  shade.id = "hw-iso-wall-shade";
  shade.setAttribute("x1", "0");
  shade.setAttribute("y1", "0");
  shade.setAttribute("x2", "0");
  shade.setAttribute("y2", "1");
  for (const [offset, opacity] of [["0", "0"], ["0.5", "0"], ["1", "var(--iso-falloff, .12)"]]) {
    const stop = document.createElementNS(ns, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("style", `stop-color: #000; stop-opacity: ${opacity}`);
    shade.append(stop);
  }
  defs.append(shade);
  // Screen glass: a faint sheen across the top-left of every display.
  const glass = document.createElementNS(ns, "linearGradient");
  glass.id = "hw-iso-glass";
  glass.setAttribute("x1", "0");
  glass.setAttribute("y1", "0");
  glass.setAttribute("x2", "1");
  glass.setAttribute("y2", "1");
  for (const [offset, colour] of [["0", "#2c2c2a"], ["0.45", "#1b1b1a"], ["1", "#121211"]]) {
    const stop = document.createElementNS(ns, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", colour);
    glass.append(stop);
  }
  defs.append(glass);
  // Floor fade: the floor grid dissolves toward the edges of its own box.
  const fade = document.createElementNS(ns, "radialGradient");
  fade.id = "hw-iso-floor-fade-gradient";
  fade.setAttribute("cx", "0.5");
  fade.setAttribute("cy", "0.5");
  fade.setAttribute("r", "0.5");
  for (const [offset, colour] of [["0", "#fff"], ["0.55", "#fff"], ["1", "#000"]]) {
    const stop = document.createElementNS(ns, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", colour);
    fade.append(stop);
  }
  defs.append(fade);
  const mask = document.createElementNS(ns, "mask");
  mask.id = "hw-iso-floor-fade";
  mask.setAttribute("maskContentUnits", "objectBoundingBox");
  const rect = document.createElementNS(ns, "rect");
  rect.setAttribute("width", "1");
  rect.setAttribute("height", "1");
  rect.setAttribute("fill", "url(#hw-iso-floor-fade-gradient)");
  mask.append(rect);
  defs.append(mask);

  // Material gradients (iso-kit MAT.*). Stops read theme variables.
  const lin = (gid, [x1, y1, x2, y2], stops) => {
    const g = document.createElementNS(ns, "linearGradient");
    g.id = gid;
    for (const [k, v] of Object.entries({ x1, y1, x2, y2 })) g.setAttribute(k, String(v));
    for (const [offset, colour, opacity] of stops) {
      const s = document.createElementNS(ns, "stop");
      s.setAttribute("offset", String(offset));
      s.setAttribute("style", `stop-color: ${colour}${opacity === undefined ? "" : `; stop-opacity: ${opacity}`}`);
      g.append(s);
    }
    defs.append(g);
  };
  // Brushed aluminium: an anisotropic sheen with two soft bright bands.
  lin("hw-iso-metal", [0, 0, 1, 1], [
    [0, "var(--iso-metal-hi)"], [0.22, "var(--iso-metal-lo)"], [0.42, "var(--iso-metal-mid)"],
    [0.6, "var(--iso-metal-hi)"], [0.78, "var(--iso-metal-lo)"], [1, "var(--iso-metal-mid)"],
  ]);
  lin("hw-iso-gold", [0, 0, 1, 1], [[0, "var(--iso-gold-hi)"], [0.5, "var(--iso-gold)"], [1, "var(--iso-gold-lo)"]]);
  lin("hw-iso-gold-v", [0, 0, 0, 1], [[0, "var(--iso-gold-hi)"], [0.45, "var(--iso-gold)"], [1, "var(--iso-gold-lo)"]]);
  lin("hw-iso-pcb", [0, 0, 1, 1], [[0, "var(--iso-pcb-top-hi)"], [1, "var(--iso-pcb-top)"]]);
  lin("hw-iso-graphite", [0, 0, 1, 1], [[0, "var(--iso-graphite-top-hi)"], [1, "var(--iso-graphite-top)"]]);
  lin("hw-iso-ic", [0, 0, 1, 1], [[0, "color-mix(in oklch, var(--iso-ic-top) 80%, white)"], [0.5, "var(--iso-ic-top)"], [1, "var(--iso-ic-top)"]]);
  lin("hw-iso-lcd", [0, 0, 1, 1], [[0, "var(--iso-glass-hi)"], [0.45, "var(--iso-glass)"], [1, "var(--iso-glass)"]]);
  lin("hw-iso-plastic", [0, 0, 1, 1], [[0, "var(--iso-top-hi)"], [1, "var(--iso-top-lo)"]]);
  // Token gloss: a white sheen fading across the top face.
  lin("hw-iso-gloss", [0, 0, 1, 1], [[0, "#fff", 0.55], [0.45, "#fff", 0.12], [1, "#fff", 0]]);
  // Brushed grain: fine lines along the iso x axis, laid over metal tops.
  const brush = document.createElementNS(ns, "pattern");
  brush.id = "hw-iso-brush";
  brush.setAttribute("patternUnits", "userSpaceOnUse");
  brush.setAttribute("width", "40");
  brush.setAttribute("height", "3");
  brush.setAttribute("patternTransform", "rotate(26.565)");
  for (const [y, o] of [[0.5, 0.16], [1.6, 0.07], [2.4, 0.11]]) {
    const l = document.createElementNS(ns, "line");
    l.setAttribute("x1", "0"); l.setAttribute("x2", "40");
    l.setAttribute("y1", String(y)); l.setAttribute("y2", String(y));
    l.setAttribute("style", `stroke: #fff; stroke-opacity: ${o}; stroke-width: .5`);
    brush.append(l);
  }
  defs.append(brush);
  svg.append(defs);
  document.body.prepend(svg);
}

if (document.body) injectGradients();
else document.addEventListener("DOMContentLoaded", injectGradients, { once: true });
