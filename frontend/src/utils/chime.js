// Un breve doppio tono (due note), per avvisare di qualcosa di nuovo senza file audio da scaricare.
// Il browser lo permette solo dopo che la persona ha toccato la pagina almeno una volta: se non può, non fa nulla.
export function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.18].forEach((t, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.frequency.value = i ? 1040 : 780;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.18);
    });
    setTimeout(() => ctx.close(), 600);
  } catch { /* audio non disponibile */ }
}
