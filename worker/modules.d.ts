/* Modules the Worker bundle pulls in that TypeScript cannot see on its own. */
declare module '*.wasm' {
  const module: WebAssembly.Module;
  export default module;
}
/* Written by scripts/horoskopos-engine-module.mjs at the start of every build; typed by src/scripts/horoskopos/share/engine.ts. */
declare module './gen/horoskopos-engine.js' {
  export const natal: unknown;
  export default natal;
}
