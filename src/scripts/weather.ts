/**
 * Live Phoenix, AZ precipitation for the Monsoon section (spec §4.5).
 * Polls the free, keyless Open-Meteo API and broadcasts 'iw:weather'
 * {raining} on the cross-subsystem event bus so the shader pipeline can
 * switch between drought dither and glyph rain. Any failure resolves
 * silently to {raining: false}.
 */
import { emit } from './events';

const API_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=33.4484&longitude=-112.074&current=precipitation,rain';

/** Re-check cadence: every 15 minutes. */
const POLL_MS = 15 * 60 * 1000;

let started = false;

interface OpenMeteoCurrent {
  current?: {
    precipitation?: number;
    rain?: number;
  };
}

async function checkWeather(): Promise<void> {
  let raining = false;
  try {
    const res = await fetch(API_URL);
    if (res.ok) {
      const data = (await res.json()) as OpenMeteoCurrent;
      const precipitation = Number(data.current?.precipitation ?? 0);
      const rain = Number(data.current?.rain ?? 0);
      raining = precipitation > 0 || rain > 0;
    }
  } catch {
    // Silent by design: a failed fetch reads as a dry sky in Phoenix.
    raining = false;
  }
  emit('iw:weather', { raining });
}

/** Idempotent: safe to call more than once; only one poll loop runs. */
export function initWeather(): void {
  if (started) return;
  started = true;
  void checkWeather();
  window.setInterval(() => {
    void checkWeather();
  }, POLL_MS);
}
