// Le sezioni delle Impostazioni di SmartEats e chi le vede: l'admin configura il locale, ogni ruolo trova il proprio
// account e le notifiche del dispositivo. Logica pura (testata): la pagina disegna solo ciò che arriva da qui.
const ALL = [
  { id: 'service', label: 'Coperto e portate', hint: 'Il coperto e l\'ordine in cui escono le portate.', admin: true, module: 'tables' },
  { id: 'rooms', label: 'Sale e tavoli', hint: 'Le sale, i tavoli e la pianta.', admin: true, module: 'tables' },
  { id: 'bookings', label: 'Prenotazioni', hint: 'Turni, chiusure e prenotazioni dal sito.', admin: true, module: 'bookings' },
  { id: 'takeaway', label: 'Asporto', hint: 'Orari di ritiro, fasce e ordini dal sito.', admin: true, module: 'takeaway' },
  { id: 'staff', label: 'Personale', hint: 'Chi può accedere e con quale ruolo.', admin: true },
  { id: 'notifications', label: 'Notifiche', hint: 'Avvisi e suono su questo dispositivo.', anyModule: ['bookings', 'takeaway'], notFor: ['kitchen'] },
  { id: 'account', label: 'Il mio account', hint: 'Il tuo nome utente, la password e i suggerimenti per migliorare SmartEats.' },
];

export const settingsSections = (user) => ALL.filter(s => {
  if (s.admin && user.role !== 'admin') return false;
  if (s.module && !user.modules?.includes(s.module)) return false;
  if (s.anyModule && !s.anyModule.some(m => user.modules?.includes(m))) return false;
  if (s.notFor?.includes(user.role)) return false;
  return true;
});
