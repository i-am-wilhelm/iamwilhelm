/**
 * Client bootstrap for every page. Each subsystem initializes independently
 * and tolerates the others being absent, so a page with no GL stage or no
 * hunt markup still boots clean.
 */
export async function boot() {
  const jobs: Promise<unknown>[] = [];

  const stage = document.getElementById('gl-stage') as HTMLCanvasElement | null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (stage && !reduced) {
    jobs.push(
      import('../webgl/pipeline').then((m) => m.initPipeline(stage)),
    );
  }

  jobs.push(import('./scroll').then((m) => m.initScroll()));
  jobs.push(import('./eggs/registry').then((m) => m.initEggs()));
  jobs.push(import('./audio/pit').then((m) => m.initOrchestraPit()));

  await Promise.allSettled(jobs);
}
