# Prova a mano

Scaletta per provare l'app come la userebbe un locale vero. Non serve capire il codice: si segue l'elenco, si spunta
quello che funziona e si annota quello che no. I test automatici (`npm run e2e`) controllano che il giro principale non
si rompa; qui si giudica quello che un test non può: se una cosa è **comoda**, **chiara**, **veloce**.

Tempo: circa 60-90 minuti per tutto. Si può fare a pezzi (ogni parte sta in piedi da sola).

## Come segnare gli esiti

Per ogni riga:

- `[x]` va bene
- `[~]` funziona ma è scomodo, lento o poco chiaro: **scrivi perché** accanto
- `[!]` non funziona o dà un errore: **scrivi cosa hai premuto e cosa è successo**

Quando hai finito, manda il file (o incolla solo le righe con `[~]` e `[!]`). Basta una frase per riga, anche
grezza: «troppo piccolo», «non capisco cosa fa», «dovevo cliccare 3 volte».

## Prima di iniziare

**Avvio.** In due terminali:

```bash
cd backend && npm run dev          # il server
cd frontend && npm run dev         # l'interfaccia
```

L'app si apre su `https://<nome-locale>.standmanager.local:5173` (per esempio `default.standmanager.local`).

**Servono due locali di prova**, creati dal pannello master (`/master`, con la password master):

1. un locale di tipo **ristorante** (es. `trattoria`), con i moduli Cucina (KDS), Statistiche e Tavoli accesi;
2. un locale di tipo **sagra** (es. `sagra`).

Per ognuno il master crea un utente `admin` con una password temporanea: al primo accesso la cambia.

**Utenti da creare** (Impostazioni → utenti, come admin del ristorante): un `cameriere`, un `cucina`, un `cassa`.

**Due finestre.** Per le prove con la cucina apri il ristorante in **due finestre diverse del browser** (meglio una
in incognito, o due browser): una come admin/cameriere, una come cucina. Non due schede nella stessa finestra, perché
condividono l'accesso.

**Dopo il deploy** ripeti le parti segnate con 📱 da un telefono vero.

---

## A. Preparazione del ristorante (come admin)

- [ ] **Impostazioni → Sale e tavoli**: crea una sala «Interna» e 6 tavoli in serie (T1-T6).
- [ ] Apri l'**editor della pianta** della sala: trascina i tavoli, cambia forma (tondo) e misura, aggiungi un **muro**
      e un **separatore**. Salva. Torna in Sala: la pianta è uguale?
- [ ] Prova **annulla** (Ctrl+Z) nell'editor, e chiudi senza salvare: ti avvisa?
- [ ] **Impostazioni → Portate**: crea Antipasti, Primi, Secondi, Dolci. Riordinale con le frecce.
- [ ] **Carta**: crea 8-10 piatti e 2 bevande. Assegna a ogni piatto la sua **portata** e (per le bevande) la destinazione Bar.
- [ ] **Carta → Opzioni dei piatti**: crea il gruppo «Cottura» (scelta singola, obbligatoria: Al sangue / Media / Ben cotta)
      e «Aggiunte» (facoltativo, fino a 2, con supplemento). Collegali a un piatto, dal form del piatto.
- [ ] **Impostazioni → Coperto**: imposta 2,00 € a persona.
- [ ] **Apri il servizio** (in alto): il nome proposto (Pranzo/Cena) è giusto per l'ora?

## B. Il giro del tavolo (cameriere)

Accedi come `cameriere` (ideale su un telefono 📱, ma prova prima da PC).

- [ ] In Sala vedi i tavoli. **Tocca T1**, imposta 4 coperti, **Apri tavolo**.
- [ ] Il conto mostra il coperto (4 × 2,00 €)? Il totale è giusto?
- [ ] **Aggiungi**: tocca un piatto con le opzioni → compare la scelta. Prova a **non** scegliere la cottura: ti blocca
      e dice cosa manca?
- [ ] Aggiungi: un antipasto, due primi, un secondo, una bevanda. A destra i piatti sono **divisi per portata**?
- [ ] Prova a **spostare una portata** con le frecce. Prova «insieme alla precedente» su una portata.
- [ ] Tocca un piatto: **nota** («senza cipolla») e cambio portata. Si capisce come si fa?
- [ ] Il pulsante dice cosa succede («Esce subito: Bevande e altro, Antipasti · Da mandare dopo: Primi, Secondi»)? È chiaro?
- [ ] **Invia in cucina**. Torni al conto: vedi le portate («In cucina», «Da mandare»)?
- [ ] Prova il **doppio tocco veloce** su «Invia in cucina»: non deve creare due comande.

## C. La cucina

Apri l'altra finestra come `cucina`.

- [ ] Compare la comanda con **tavolo, coperti, portata e minuti**? Le bevande escono insieme agli antipasti?
- [ ] Le portate «da mandare» **non** compaiono tra le comande; stanno in basso in «In arrivo»?
- [ ] Tocca un **singolo piatto**: si barra. Toccalo di nuovo: torna da fare?
- [ ] Premi **Pronta** sulla comanda. Sparisce?
- [ ] Nella finestra della sala compare l'avviso «Tavolo T1: Antipasti pronti»? Il tavolo mostra il segno verde per un po'?
- [ ] Aspetta 10 minuti (o fingi): la barra della comanda diventa ambra e poi rossa?
- [ ] Se hai bevande al bar: compaiono i tab **Cucina / Bar**? Nascono solo se serve?

## D. Portate, conto, incasso

- [ ] Sul conto premi **Manda** (prossima portata): arriva in cucina? La stampa parte (se hai la stampante)?
- [ ] Ordina un secondo giro (altre bevande) mentre ci sono portate ancora da mandare: si accoda dopo le altre?
- [ ] Menu **⋯** del conto: **Modifica i coperti** (6 → coperto aggiornato), **Il cliente chiede il conto** (il tavolo cambia colore).
- [ ] **Sposta tavolo** su un tavolo libero. La cucina vede il tavolo nuovo?
- [ ] Apri un secondo tavolo e **unisci** i due conti (come admin).
- [ ] **Omaggio o sconto** su un piatto. Il totale si aggiorna?
- [ ] **Incassa → Per voce**: di partenza è già tutto selezionato? Deseleziona un piatto e incassa a «Contanti»;
      con contanti ricevuti (es. 50 €): il resto è chiaro?
- [ ] **Incassa → A importo → Alla romana** con 3 persone: le quote sono giuste?
- [ ] Incassa **tutto** senza resto (es. carta): il pannello torna da solo alla sala e **il tavolo è libero**?
- [ ] Prova a incassare con una portata ancora da mandare: ti dice di mandarla o stornarla?
- [ ] Stampa la **ricevuta** (non fiscale): il testo e gli importi sono giusti?

## E. Il cameriere non deve poter fare certe cose

Come `cameriere`:

- [ ] **Non** vede «Incassa», «Omaggio o sconto», «Elimina conto», «Unisci».
- [ ] Vede «Chiedi il conto». Funziona?
- [ ] Non può stornare una comanda.

## F. Statistiche (admin)

- [ ] Dopo qualche conto pagato: **Statistiche** mostra incasso, coperti, scontrino per coperto, durata, rotazione?
- [ ] I numeri tornano con quello che hai incassato?
- [ ] Il grafico per ora: passa il mouse sulle barre, compare il valore? Prova la vista **Tabella**.
- [ ] Piatti più venduti e portate: ordinati bene?
- [ ] Cambia il filtro del servizio: i numeri cambiano?

## G. Chiusura del servizio

- [ ] Lascia un tavolo con il conto aperto e prova a **chiudere il servizio**: ti ferma dicendo che ci sono conti aperti?
- [ ] Incassa tutto e chiudi: ti chiede il conteggio dei contanti? Il confronto con l'atteso è giusto?

---

## H. La sagra (admin)

**Su PC o tablet in orizzontale**

- [ ] **Apri la sessione**. La cassa mostra prodotti a sinistra e carrello a destra.
- [ ] Aggiungi 3 prodotti, uno più volte. Il totale è giusto?
- [ ] Tocca una riga del carrello: **nota**, **sconto**, **omaggio**. I totali si aggiornano?
- [ ] **Asporto** (la borsetta): l'ordine è segnato?
- [ ] Contanti ricevuti 20 €: il **resto** è giusto? I tasti rapidi (5/10/20/50) funzionano?
- [ ] **Invia ordine**: il carrello si svuota, il numero ordine (A1, A2…) è progressivo?
- [ ] **Storno ordini**: stornare un ordine fa tornare il prodotto disponibile (se ha stock)?
- [ ] Prodotto con **stock** a 2: aggiungi 3 volte, ti ferma?

**📱 Su telefono**

- [ ] Le **categorie** sono chip scorrevoli: si capisce che si scorre?
- [ ] Tocca due volte un prodotto: la tessera mostra la quantità e il **−**?
- [ ] La **barra in basso** dice articoli e totale? Non copre l'ultima riga di prodotti?
- [ ] Apri la cassa: **più e meno** sulle righe funzionano? Il pagamento è a portata di pollice?
- [ ] «Resto» è neutro finché non scrivi i contanti?
- [ ] **Invia ordine** e torna ai prodotti da solo?
- [ ] Ruota il telefono in orizzontale: sta ancora tutto in pagina?

**Su tablet in verticale (768-1024 px)**

- [ ] Compaiono sia il menu laterale (a icone) sia il carrello a destra?

## I. Cucina della sagra

- [ ] Come `cucina`: l'ordine arriva da solo?
- [ ] Il pulsante di completamento funziona? La scansione del QR funziona (se la usi)?
- [ ] Il **KDS pubblico** (`/kds`, senza accesso) si aggiorna da solo su un secondo schermo?

## J. Stampa

Se non hai una stampante, avvia il simulatore: `cd frontend && npm run mock:epos`, e in Impostazioni → Stampa
imposta l'indirizzo `https://localhost:9443`.

- [ ] La comanda stampa **tavolo, coperti, portata**, i piatti con le **opzioni** e le note?
- [ ] La stampa per bar e per cucina è divisa come ti aspetti?
- [ ] Spegni la stampante: l'ordine passa lo stesso, e la stampa si ripete quando torna?

## K. Senza rete (sagra)

- [ ] Spegni il Wi-Fi sul telefono/PC della cassa e batti 3 ordini: il segno di «offline» compare?
- [ ] Riaccendi: gli ordini si inviano da soli? Compare qualche ordine «rifiutato»?
- [ ] Il ristorante senza rete: cosa succede quando provi a inviare una comanda? Il messaggio è chiaro?

## L. Cose strane da provare (se hai tempo)

- [ ] Due telefoni sul **stesso tavolo** contemporaneamente: cosa succede?
- [ ] Tocchi indietro durante una comanda: perdi i piatti che avevi scelto?
- [ ] Aggiorna la pagina (F5) con una comanda a metà: cosa resta?
- [ ] Tema **chiaro**: ci sono scritte illeggibili o sfondi stonati?
- [ ] Un nome di piatto molto lungo (40 caratteri): si legge ancora?

---

## Dopo la prova

Mandami le righe `[~]` e `[!]`. Per ogni problema mi bastano:

1. **dove** (es. «Sala, conto, dopo aver premuto Manda»);
2. **cosa ti aspettavi**;
3. **cosa è successo**.

Se puoi, uno **screenshot**. Poi li sistemo a gruppi, e rifacciamo solo le parti toccate.
