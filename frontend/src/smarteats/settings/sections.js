// Le sezioni delle Impostazioni di SmartEats e chi le vede: l'admin configura il locale; admin e responsabile hanno
// l'Account (il proprio profilo e, per l'admin, gli utenti); le notifiche sono del dispositivo. Cassa, cameriere e cucina
// non cambiano username e password da soli: se dimenticano la password l'admin ne dà una temporanea.
// Logica pura (testata): la pagina disegna solo ciò che arriva da qui.
const ALL = [
  { id: 'service', label: 'Portate', hint: 'Il coperto e l\'ordine in cui escono le portate.', admin: true, module: 'tables' },
  { id: 'rooms', label: 'Sale', hint: 'Le sale, i tavoli e la pianta.', admin: true, module: 'tables' },
  { id: 'bookings', label: 'Prenotazioni', hint: 'Turni, chiusure e prenotazioni dal sito.', admin: true, module: 'bookings' },
  { id: 'takeaway', label: 'Asporto', hint: 'Orari di ritiro, fasce e ordini dal sito.', admin: true, module: 'takeaway' },
  { id: 'notifications', label: 'Notifiche', hint: 'Avvisi e suono su questo dispositivo.', anyModule: ['bookings', 'takeaway'], notFor: ['kitchen'] },
  { id: 'account', label: 'Account', hint: 'Il tuo profilo, chi può accedere e i suggerimenti per migliorare SmartEats.', roles: ['admin', 'manager'] },
];

export const settingsSections = (user) => ALL.filter(s => {
  if (s.admin && user.role !== 'admin') return false;
  if (s.roles && !s.roles.includes(user.role)) return false;
  if (s.module && !user.modules?.includes(s.module)) return false;
  if (s.anyModule && !s.anyModule.some(m => user.modules?.includes(m))) return false;
  if (s.notFor?.includes(user.role)) return false;
  return true;
});
