/** Test helpers: the engine as a module (built fresh from public/machines/natal/), and charts cast from its library. */
import { buildEngineModule } from '../../scripts/horoskopos-engine-module.mjs';
import { pathToFileURL } from 'node:url';
import type { EngineChart, Natal } from '../../src/scripts/horoskopos/share/engine.ts';

const mod = await import(pathToFileURL(buildEngineModule()).href);
export const natal = mod.natal as Natal & {
  figById(id: string): Record<string, unknown>;
  M: { specOf(f: unknown, hsys?: string): Record<string, unknown> };
  C: Natal['C'] & { cast(spec: unknown): EngineChart; davison(a: EngineChart, b: EngineChart, hsys?: string): EngineChart };
  L: { FIGURES: Array<{ id: string; name: string; t?: number[] }>; PAIRS: string[][] };
};

export function cast(id: string, hsys = 'P'): EngineChart {
  return natal.C.cast(natal.M.specOf(natal.figById(id), hsys));
}
export const FIGURES = natal.L.FIGURES.map((f) => f.id);
