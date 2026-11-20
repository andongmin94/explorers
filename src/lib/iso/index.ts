// Isometric scenes: the drawing kit (SVG-string builders), the shared
// gradients and the Liquid Glass lens. Scenes stay imperative: build an SVG
// string with these, put it into a host element from a React effect, and
// move tokens with WAAPI (see src/explorers/cpu/scene.ts).
export * from "./kit.ts";
export { mountIsoDefs } from "./defs.ts";
