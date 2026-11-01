// Le sezioni delle Impostazioni della cassa delle sagre e chi le vede. Logica pura (testata): la pagina disegna
// solo ciò che arriva da qui. Ordine: prima ciò che si tocca più spesso. L'Account (profilo e utenti) è di admin
// e responsabile: gli altri non cambiano username e password da soli, se dimenticano la password l'admin ne dà una temporanea.
const ALL = [
  { id: 'device', label: 'Dispositivo', hint: 'Tema, suoni e modo di inviare gli ordini su questo dispositivo.', notFor: ['kitchen'] },
  { id: 'takeaway', label: 'Asporto', hint: 'Orari di ritiro, fasce e ordini dal sito.', admin: true, module: 'takeaway' },
  { id: 'inventory', label: 'Magazzino', hint: 'L\'IVA predefinita per calcolare i margini.', admin: true, warehouse: true },
  { id: 'menu', label: 'Menu pubblico', hint: 'Il QR da mettere sul banco: i clienti scelgono i prodotti e lo mostrano alla cassa.', module: 'qr_menu', notFor: ['kitchen'] },
  { id: 'printing', label: 'Stampa', hint: 'Stampanti e copie degli scontrini.', notFor: ['kitchen'] },
  { id: 'reserved', label: 'Dati riservati', hint: 'Nascondi incassi e statistiche: si sbloccano con la password di un amministratore.', admin: true, notFor: ['kitchen'] },
  { id: 'account', label: 'Account', hint: 'Il tuo profilo e chi può accedere al locale.', roles: ['admin', 'manager'] },
];

export const festivalSections = (user) => ALL.filter(s => {
  if (s.admin && user.role !== 'admin') return false;
  if (s.roles && !s.roles.includes(user.role)) return false;
  if (s.module && !user.modules?.includes(s.module)) return false;
  if (s.warehouse && user.inventory?.mode !== 'warehouse') return false;
  if (s.notFor?.includes(user.role)) return false;
  return true;
});
