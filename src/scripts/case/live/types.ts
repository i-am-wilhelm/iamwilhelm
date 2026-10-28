/**
 * Live console scenes. A cartridge with `live` in work.ts names a module in
 * this folder; console.ts imports it on demand once the screenshot has
 * resolved and mounts it on the CRT's live canvas, over the still frame.
 *
 * Contract: `mount(canvas, opts)` sizes and owns the canvas, runs its own
 * rAF, and returns handles the console uses to idle it off screen and tear
 * it down on eject. Under reduced motion a scene paints one frame and never
 * animates.
 */
export interface LiveOpts {
  reduced: boolean;
}

export interface LiveScene {
  pause(): void;
  resume(): void;
  destroy(): void;
}

export type LiveMount = (canvas: HTMLCanvasElement, opts: LiveOpts) => LiveScene;
