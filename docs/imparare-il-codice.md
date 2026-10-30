# Imparare il codice di SmartEats (React e JavaScript), un passo alla volta

Per chi parte da zero e vuole capire **tutto**. Il progetto è un buon posto per imparare perché è ordinato e ogni cosa ha un test. Non va letto dall'inizio alla fine: si impara **partendo da una schermata che conosci** e seguendo il filo.

## 1. Il metodo che vale più di tutti: seguire il filo
Prendi una cosa che vedi a schermo e risali al codice.
1. In VS Code: `Cmd+Shift+F` (cerca in tutto il progetto) e scrivi il **testo** che vedi, per esempio «Apri il conto in Sala».
2. Il risultato è un file `.jsx`: è il **componente** che lo disegna. Leggi le righe intorno al testo.
3. Se è un pulsante, guarda `onClick={...}`: cosa succede quando lo premi? Spesso chiama una funzione definita sopra.
4. Se la funzione chiama il server (`fetchWithAuth('/qualcosa')`), cerca `/qualcosa` in `backend/routes/`: lì c'è la parte del server.
5. Il server usa spesso una funzione in `backend/utils/`: lì sta la regola vera (con un test accanto).
Fai questo per dieci schermate e avrai la mappa mentale di tutto il progetto.

## 2. I concetti di React (in ordine)
Tutti si vedono in file piccoli del progetto.
| Concetto | Cosa vuol dire | Dove lo vedi |
|---|---|---|
| **Componente** | Una funzione che restituisce un pezzo di schermata (JSX). Il nome inizia con la maiuscola. | `components/shared/Switch.jsx` (14 righe) |
| **JSX** | HTML scritto dentro JavaScript; `{...}` inserisce un valore o un'espressione. | qualsiasi `.jsx` |
| **Props** | I dati che un componente riceve dal genitore, come attributi: `<Switch checked={on} label="…" />`. | `Switch.jsx`, `ActionMenu.jsx` |
| **State** (`useState`) | Un valore che il componente ricorda; quando cambia, la schermata si ridisegna. | `hooks/useTheme.js`, `floor/FloorView.jsx` (la sala scelta) |
| **Effetto** (`useEffect`) | Codice che gira *dopo* che la schermata è comparsa o quando un valore cambia (caricare dati, ascoltare eventi). | `hooks/usePageTitle.js` |
| **Hook personalizzato** | Una funzione `useXxx` che raccoglie state ed effetti per riusarli. | `smarteats/reservations/useBookings.js`, `festival/useFestivalData.js` |
| **Liste** | `.map()` per disegnare un elemento per ogni dato, con `key`. | `components/master/TenantCard.jsx` nell'elenco di `MasterPage.jsx` |
| **Rendering condizionale** | `{cond && <X />}` o `cond ? <A /> : <B />`. | ovunque |
| **Routing** | Un indirizzo = una pagina (`react-router-dom`). | `smarteats/app/SmartEatsApp.jsx` |
Regola d'oro: **la schermata è una funzione dei dati** (props + state). Non si «modifica» la pagina: si cambia un dato e React la ridisegna.

## 3. I concetti di JavaScript che servono davvero
`const`/`let`, funzioni e funzioni freccia `(x) => x + 1`, oggetti e array, **destrutturazione** (`const { a, b } = obj`), **spread** (`{ ...obj, a: 1 }`), `map`/`filter`/`find`/`reduce`, `async`/`await` e le Promise, `try`/`catch`, i moduli (`import`/`export`). Quasi tutto il codice del progetto usa solo questo.

## 4. Un percorso di lettura (dal più facile)
1. `frontend/src/smarteats/floor/seats.js` e `seats.test.js`: funzioni **pure** (nessuna grafica), con i test che spiegano ogni caso. Leggi prima il test.
2. `frontend/src/components/shared/Switch.jsx`: il componente più piccolo.
3. `frontend/src/hooks/usePageTitle.js` e `useTheme.js`: i primi hook.
4. `frontend/src/components/shell/SectionsPage.jsx`: un componente con state e liste.
5. `frontend/src/smarteats/reservations/useBookings.js`: come si caricano i dati dal server.
6. `frontend/src/smarteats/floor/FloorView.jsx`: una schermata vera.
7. `frontend/src/smarteats/floor/FloorPage.jsx`: come più componenti si parlano (stato in alto, props in basso).
8. Lato server: `backend/routes/rooms.js` (una route), poi `backend/utils/occupancy.js` (logica pura) e i suoi test.
Le regole del progetto e la mappa delle cartelle sono in `CLAUDE.md` (§2 e seguenti).

## 5. Esercizi (piccoli e sicuri: se sbagli, `git restore` rimette tutto)
1. Cambia un testo (per esempio «Walk-in») e guarda la schermata aggiornarsi.
2. In `Switch.jsx` cambia il colore quando è acceso.
3. Rompi apposta un test: cambia un numero in `seats.js`, lancia `cd frontend && npm test` e **leggi l'errore**: dice quale test, cosa si aspettava e cosa è arrivato.
4. Aggiungi `console.log(props)` in un componente e guarda la console del browser.
5. Aggiungi un pulsante che mostra un messaggio con `showToast('Ciao', 'success')` (vedi come lo usano gli altri componenti).

## 6. Strumenti che ti fanno capire più in fretta
- **React Developer Tools** (estensione di Chrome): mostra l'albero dei componenti con props e state in tempo reale. È il modo migliore per «vedere» React.
- **Console e Rete del browser** (tasto destro → Ispeziona): la console mostra gli errori, la scheda Rete le chiamate al server con la risposta.
- **`git log -p -- percorso/del/file`**: la storia di un file, con ogni modifica. Si vede *come* è stata costruita una funzione, passo per passo.
- **`./scripts/check.sh`**: dopo ogni tua prova ti dice se hai rotto qualcosa (vedi `docs/guida-al-codice.md`, §1).

## 7. Dove studiare (gratis e in italiano o ben fatto)
- React, la guida ufficiale (interattiva): <https://react.dev/learn>
- JavaScript moderno, in italiano: <https://it.javascript.info/>
- MDN, il riferimento di HTML, CSS e JavaScript: <https://developer.mozilla.org/it/>
- Tailwind (le classi che vedi nei `className`): <https://tailwindcss.com/docs>
Consiglio: alterna una sezione di teoria a un esercizio sul progetto. Il codice reale ti fa ricordare quello che hai letto.

## 8. Come procedere se qualcosa non si capisce
Annota il **file e la riga** e chiedi: «cosa fa questa riga e perché è scritta così?». La domanda precisa vale più di una generica. E prima di toccare qualcosa di importante, fai un ramo (`git switch -c prova/xyz`): puoi sempre tornare indietro.
