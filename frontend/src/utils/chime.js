// Un breve doppio tono (due note), per avvisare di qualcosa di nuovo senza file audio da scaricare.
// Il browser permette l'audio solo dopo che la persona ha toccato la pagina: un unico contesto audio, creato una volta,
// si «sblocca» al primo gesto (clic, tocco, tasto) e poi suona quando serve, anche se la scheda è in secondo piano.
let ctx = null;
const getContext = () => {
  try { ctx ??= new (window.AudioContext || window.webkitAudioContext)(); return ctx; } catch { return null; }
};

function unlockAudio() {
  const c = getContext();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlockAudio, { passive: true });
}

// Ritorna true se il suono è partito, false se il browser non lo permette (nessun gesto ancora, audio assente).
export async function playChime() {
  const c = getContext();
  if (!c) return false;
  if (c.state === 'suspended') { try { await c.resume(); } catch { return false; } }
  if (c.state !== 'running') return false;
  [0, 0.18].forEach((t, i) => {
    const osc = c.createOscillator(), gain = c.createGain();
    osc.frequency.value = i ? 1040 : 780;
    gain.gain.setValueAtTime(0.0001, c.currentTime + t);
    gain.gain.exponentialRampToValueAtTime(0.3, c.currentTime + t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + 0.16);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime + t); osc.stop(c.currentTime + t + 0.18);
  });
  return true;
}
