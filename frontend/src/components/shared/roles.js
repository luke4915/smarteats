// Ruoli degli utenti, con l'etichetta mostrata in interfaccia (stessi valori di ROLES nel backend).
export const ROLE_OPTIONS = [
  { value: 'cashier', label: 'Cassa' },
  { value: 'waiter', label: 'Cameriere' },
  { value: 'kitchen', label: 'Cucina' },
  { value: 'manager', label: 'Responsabile' },
  { value: 'admin', label: 'Admin' },
];

export const roleLabel = (role) => ROLE_OPTIONS.find(r => r.value === role)?.label ?? role;
