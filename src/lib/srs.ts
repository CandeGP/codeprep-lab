/**
 * Repetición espaciada basada en SM-2.
 * quality: 0-5 (0 = no la recordé, 3 = correcta con esfuerzo, 5 = perfecta).
 */
export type CardState = { ease: number; interval: number; repetitions: number; lapses: number };

export function schedule(card: CardState, quality: number, now = new Date()) {
  let { ease, interval, repetitions, lapses } = card;
  if (quality < 3) {
    repetitions = 0;
    interval = 0; // vuelve hoy mismo (en 10 minutos)
    lapses += 1;
  } else {
    repetitions += 1;
    interval = repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.round(interval * ease);
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const dueAt =
    interval === 0 ? new Date(now.getTime() + 10 * 60 * 1000) : new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
  return { ease, interval, repetitions, lapses, dueAt };
}
