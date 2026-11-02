// La larghezza della carta di una stampante e quante lettere stanno in una riga. Logica pura (testata).
// 80 mm è la carta delle stampanti da banco (42 lettere con il carattere normale, come si è sempre fatto); 58 mm quella delle piccole,
// da food truck e banco (32 lettere).
export const PAPER_OPTIONS = [
  { mm: 58, columns: 32, label: '58 mm' },
  { mm: 80, columns: 42, label: '80 mm' },
];
export const DEFAULT_PAPER_MM = 80;

export const columnsForPaper = (mm) => (PAPER_OPTIONS.find(p => p.mm === Number(mm)) ?? PAPER_OPTIONS.find(p => p.mm === DEFAULT_PAPER_MM)).columns;

