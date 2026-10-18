// Le sezioni delle Impostazioni della cassa delle sagre e chi le vede. Logica pura (testata): la pagina disegna solo ciò
// che arriva da qui. Ordine: prima ciò che si tocca più spesso.
const ALL = [
  { id: 'device', label: 'Questo dispositivo', hint: 'Tema, suoni e modo di inviare gli ordini su questo dispositivo.', notFor: ['kitchen'] },
  { id: 'takeaway', label: 'Asporto', hint: 'Orari di ritiro, fasce e ordini dal sito.', admin: true, module: 'takeaway' },
  { id: 'menu', label: 'Menu pubblico', hint: 'Il messaggio di benvenuto che i clienti leggono dal QR.', notFor: ['kitchen'] },
  { id: 'printing', label: 'Stampa', hint: 'Stampanti e copie degli scontrini.', notFor: ['kitchen'] },
  { id: 'staff', label: 'Personale', hint: 'Chi può accedere e con quale ruolo.', admin: true },
  { id: 'account', label: 'Il mio account', hint: 'Il tuo nome utente, la password e i suggerimenti per migliorare l\'app.' },
];

export const festivalSections = (user) => ALL.filter(s => {
  if (s.admin && user.role !== 'admin') return false;
  if (s.module && !user.modules?.includes(s.module)) return false;
  if (s.notFor?.includes(user.role)) return false;
  return true;
});
