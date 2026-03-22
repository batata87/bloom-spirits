/** Very soft UI tick — Web Audio, no file. */
export function playSoftClick() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(520, now + 0.06);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.04, now + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);
  ctx.resume().catch(() => {});
  setTimeout(() => ctx.close().catch(() => {}), 200);
}
