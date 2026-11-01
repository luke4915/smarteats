// Regole del blocco automatico dello schermo, pure: quando si deve bloccare dopo un certo tempo senza toccare nulla.
export const AUTO_LOCK_CHOICES = [0, 5, 15];   // minuti; 0 = mai

export const isAutoLockChoice = (minutes) => AUTO_LOCK_CHOICES.includes(minutes);

// Da quanto tempo non si tocca nulla (`lastActivity`, in millisecondi): è ora di bloccare?
export const shouldAutoLock = (minutes, lastActivity, now = Date.now()) => minutes > 0 && now - lastActivity >= minutes * 60_000;

export const autoLockLabel = (minutes) => (minutes === 0 ? 'Mai' : `${minutes} min`);
