// sim/kernel/clock.js — game minutes, fixed steps, content-defined phases (M001).
// Frame rate never affects outcomes. Real-world elapsed time is never used.

export const STEP_MINUTES = 5;

// Boundaries are content (change without code). minutes%1440 < until.
const DEFAULT_PHASES = [
  { name: 'Night', until: 300 },
  { name: 'Morning', until: 720 },
  { name: 'Afternoon', until: 1080 },
  { name: 'Evening', until: 1320 },
  { name: 'Night', until: 1440 },
];

export function createClock({ startMinutes = 480, stepMinutes = STEP_MINUTES, phases = DEFAULT_PHASES } = {}) {
  let minutes = startMinutes;
  let stepCount = 0;

  function phaseAt(m) {
    const t = ((m % 1440) + 1440) % 1440;
    for (const p of phases) if (t < p.until) return p.name;
    return 'Night';
  }

  return {
    get minutes() { return minutes; },
    get stepCount() { return stepCount; },
    get stepMinutes() { return stepMinutes; },
    day() { return Math.floor(minutes / 1440) + 1; },
    phase() { return phaseAt(minutes); },
    advance(steps = 1) {
      if (!Number.isInteger(steps) || steps < 1) throw new Error(`bad_steps: ${steps}`);
      const crossed = [];
      for (let i = 0; i < steps; i++) {
        const before = phaseAt(minutes);
        minutes += stepMinutes;
        stepCount += 1;
        const after = phaseAt(minutes);
        if (after !== before) crossed.push({ step: stepCount, from: before, to: after, minutes });
      }
      return crossed;
    },
    getState() { return { minutes, stepCount, stepMinutes }; },
    setState(s) { minutes = s.minutes; stepCount = s.stepCount; },
  };
}
