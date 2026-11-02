// Tutti i suoni dell'app, generati dal browser (nessun file da scaricare: suonano anche senza rete). Un solo contesto audio:
// il browser permette l'audio solo dopo che la persona ha toccato la pagina, quindi si «sblocca» al primo gesto
// (clic, tocco, tasto) e poi suona quando serve, anche se la scheda è in secondo piano.
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

// La campanella (qualcosa di nuovo) è un doppio tono generato dal browser. Gli altri suoni sono file (src/assets/sounds), inclusi
// nell'app e conservati dal service worker: suonano anche senza rete. Si decodificano una volta sola.
const CHIME = [{ at: 0, freq: 780, len: 0.16, vol: 0.3 }, { at: 0.18, freq: 1040, len: 0.16, vol: 0.3 }];
const FILES = {   // tocco su un prodotto, ordine inviato, carrello svuotato
  tap: new URL('../assets/sounds/tap.mp3', import.meta.url).href,
  confirm: new URL('../assets/sounds/confirm.mp3', import.meta.url).href,
  clear: new URL('../assets/sounds/clear.mp3', import.meta.url).href,
};
const decoded = {};
const FILE_VOLUME = 0.15;

async function readyContext() {
  const c = getContext();
  if (!c) return null;
  if (c.state === 'suspended') { try { await c.resume(); } catch { return null; } }
  return c.state === 'running' ? c : null;
}

async function playFile(c, name) {
  decoded[name] ??= fetch(FILES[name]).then(r => r.arrayBuffer()).then(b => c.decodeAudioData(b));
  const source = c.createBufferSource(), gain = c.createGain();
  source.buffer = await decoded[name];
  gain.gain.value = FILE_VOLUME;
  source.connect(gain).connect(c.destination);
  source.start(0);
}

function playChime(c) {
  for (const { at, freq, len, vol } of CHIME) {
    const osc = c.createOscillator(), gain = c.createGain(), start = c.currentTime + at;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + len);
    osc.connect(gain).connect(c.destination);
    osc.start(start); osc.stop(start + len + 0.02);
  }
}

// Ritorna true se il suono è partito, false se il browser non lo permette (nessun gesto ancora, audio assente).
export async function playSound(name) {
  if (name !== 'chime' && !FILES[name]) return false;
  const c = await readyContext();
  if (!c) return false;
  try { if (name === 'chime') playChime(c); else await playFile(c, name); return true; }
  catch { delete decoded[name]; return false; }
}

// «Suono al tocco»: una scelta di questo dispositivo. Senza scelta salvata vale `fallback` (acceso nelle sagre, spento al ristorante).
const KEY = 'tap_sound';
export function tapSoundOn(fallback = true) {
  try { const saved = localStorage.getItem(KEY); return saved === null ? fallback : saved === 'on'; } catch { return fallback; }
}
export function setTapSound(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* senza archivio locale vale solo finché la pagina resta aperta */ }
}
export const playTapSound = (name, fallback = true) => { if (tapSoundOn(fallback)) playSound(name); };
