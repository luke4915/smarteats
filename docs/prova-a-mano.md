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
2. un locale di tipo **sagra** (es. `street_food`).

Per ognuno il master crea un utente `admin` con una password temporanea: al primo accesso la cambia.

**Utenti da creare** (Impostazioni → utenti, come admin del ristorante): un `waiter`, un `kitchen`, un `cashier`.

**Due finestre.** Per le prove con la cucina apri il ristorante in **due finestre diverse del browser** (meglio una
in incognito, o due browser): una come admin/cameriere, una come cucina. Non due schede nella stessa finestra, perché
condividono l'accesso.

**Dopo il deploy** ripeti le parti segnate con 📱 da un telefono vero.

---

## A. Preparazione del ristorante (come admin)

- [x] **Impostazioni → Sale e tavoli**: crea una sala «Interna» e 6 tavoli in serie (T1-T6).
- [--] Apri l'**editor della pianta** della sala: trascina i tavoli, cambia forma (tondo) e misura, aggiungi un **muro**
      e un **separatore**. Salva. Torna in Sala: la pianta è uguale?
la gestione dei separatori è un po' macchinosa, non posso fare resizing come per i tavoli, e l'anchor di resizing non mi piace sui tavoli. cambialo e rendilo uniforme per tavoli e separatori. il muro non penso serva più a sto punto, intendevo separatori per visualizzare meglio la sala.
- [x] Prova **annulla** (Ctrl+Z) nell'editor, e chiudi senza salvare: ti avvisa? metti solo manina clic su modale di conferma modifiche o annullamento.
- [--] **Impostazioni → Portate**: crea Antipasti, Primi, Secondi, Dolci. Riordinale con le frecce.
ok, ma molto macchinoso con le freccette, metti dei trascinabili stile ordinamento stampe sul modulo sagra, non so se chiaro. cerchiamo di tenere uno stile app uniforme su tutti i moduli, così da diventare identità dell'app complessiva. devo avere la possibilità di mettere però due categorie vicine o comunque trovare un modo per gestire tipo secondi e contorni che dovrebbero uscire insieme, ma con questa logica escono sempre sequenzialmente (a meno che io crei una categoria "secondi e contorni").
- [x] **Carta**: crea 8-10 piatti e 2 bevande. Assegna a ogni piatto la sua **portata** e (per le bevande) la destinazione Bar.
- [x] **Carta → Opzioni dei piatti**: crea il gruppo «Cottura» (scelta singola, obbligatoria: Al sangue / Media / Ben cotta)
      e «Aggiunte» (facoltativo, fino a 2, con supplemento). Collegali a un piatto, dal form del piatto.
- [x] **Impostazioni → Coperto**: imposta 2,00 € a persona.
- [x] **Apri il servizio** (in alto): il nome proposto (Pranzo/Cena) è giusto per l'ora?

## B. Il giro del tavolo (cameriere)

Accedi come `waiter` (ideale su un telefono 📱, ma prova prima da PC).

- [x] In Sala vedi i tavoli. **Tocca T1**, imposta 4 coperti, **Apri tavolo**.
- [x] Il conto mostra il coperto (4 × 2,00 €)? Il totale è giusto?
- [x] **Aggiungi**: tocca un piatto con le opzioni → compare la scelta. Prova a **non** scegliere la cottura: ti blocca
      e dice cosa manca?
- [x] Aggiungi: un antipasto, due primi, un secondo, una bevanda. A destra i piatti sono **divisi per portata**?
- [--] Prova a **spostare una portata** con le frecce. Prova «insieme alla precedente» su una portata.
ok, ma lo spostamento è fatto su tutta la categoria, non sulla singola portata. idem per il dopo e prima la precedente.
- [!] Tocca un piatto: **nota** («senza cipolla») e cambio portata. Si capisce come si fa?
appena scrivo una lettera si toglie il campo di inserimento note. sfrutta il modo di inserimento note del modulo sagra, funziona bene, con capitalized letters.
- [--] Il pulsante dice cosa succede («Esce subito: Bevande e altro, Antipasti · Da mandare dopo: Primi, Secondi»)? È chiaro?
ok il dettaglio, ma su un tablet deve essere bello visibile e comunque sempre professionale e bello da vedere, puoi migliorare? se necessario rifai pure la grafica eh, stupiscimi.
- [x] **Invia in cucina**. Torni al conto: vedi le portate («In cucina», «Da mandare»)?
- [x] Prova il **doppio tocco veloce** su «Invia in cucina»: non deve creare due comande.

## C. La cucina

Apri l'altra finestra come `kitchen`.

- [x] Compare la comanda con **tavolo, coperti, portata e minuti**? Le bevande escono insieme agli antipasti?
non ho controllato bevande e antipasti se escono insieme.
- [x] Le portate «da mandare» **non** compaiono tra le comande; stanno in basso in «In arrivo»? di nuovo, questa specie di kds deve essere ottimizzato per l'ambiente frenetico della cucina.
- [x] Tocca un **singolo piatto**: si barra. Toccalo di nuovo: torna da fare?
- [x] Premi **Pronta** sulla comanda. Sparisce?
- [--] Nella finestra della sala compare l'avviso «Tavolo T1: Antipasti pronti»? Il tavolo mostra il segno verde per un po'?
non mi risulta che rimanga un badge. sarebbe buono una motifica in realtà, e solo sui terminali dei camerieri/del cameriere che hanno preso in gestione quel tavolo lì.
- [x] Aspetta 10 minuti (o fingi): la barra della comanda diventa ambra e poi rossa?
- [x] Se hai bevande al bar: compaiono i tab **Cucina / Bar**? Nascono solo se serve?

## D. Portate, conto, incasso

- [ ] Sul conto premi **Manda** (prossima portata): arriva in cucina? La stampa parte (se hai la stampante)? non posso testare ora
- [ ] Ordina un secondo giro (altre bevande) mentre ci sono portate ancora da mandare: si accoda dopo le altre?
- [x] Menu **⋯** del conto: **Modifica i coperti** (6 → coperto aggiornato), **Il cliente chiede il conto** (il tavolo cambia colore).
- [] **Sposta tavolo** su un tavolo libero. La cucina vede il tavolo nuovo?
- [ ] Apri un secondo tavolo e **unisci** i due conti (come admin).
- [ ] **Omaggio o sconto** su un piatto. Il totale si aggiorna?
- [ ] **Incassa → Per voce**: di partenza è già tutto selezionato? Deseleziona un piatto e incassa a «Contanti»;
      con contanti ricevuti (es. 50 €): il resto è chiaro?
- [--] **Incassa → A importo → Alla romana** con 3 persone: le quote sono giuste?
si però è diffficile pagare alla romana, appenaclicco sul pagamento di una quota, si toglie la schermata e devo rifare tutto il processo si suddivisione. guarda anche tu cosa accade.
- [x] Incassa **tutto** senza resto (es. carta): il pannello torna da solo alla sala e **il tavolo è libero**?
si però non riesco a far fare l'incasso. rimane la schermata di pagamento purtroppo, come se non venisse incassato. risolvi pls, non mi esce neanche nessun badge.
- [x] Prova a incassare con una portata ancora da mandare: ti dice di mandarla o stornarla?
- [ ] Stampa la **ricevuta** (non fiscale): il testo e gli importi sono giusti? non posso testare ora

## E. Il cameriere non deve poter fare certe cose

Come `waiter`:

- [x] **Non** vede «Incassa», «Omaggio o sconto», «Elimina conto», «Unisci».
- [x] Vede «Chiedi il conto». Funziona?
- [x] Non può stornare una comanda. si però dovrebbe poterlo fare, direi.

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

## G2. Le prenotazioni (admin, e poi cameriere)

Serve il modulo **Prenotazioni** acceso per il ristorante (dal pannello master).

- [ ] **Impostazioni → Turni delle prenotazioni**: crea «Cena 19:30» (90 minuti, 30 coperti) e «Cena 21:00». Cambia giorni e capienza.
- [ ] **Chiusure**: chiudi un giorno (es. domani). Nell'agenda quel giorno i turni risultano chiusi?
- [ ] **Prenotazioni → Nuova**: inserisci «Rossi, 4 persone, 19:30». Compare nell'agenda con i coperti del turno che salgono?
- [ ] Inserisci prenotazioni fino a superare la capienza: ti dice che non ci sono posti e ti lascia **accettare comunque**?
- [ ] Apri la prenotazione: **Avvisa il cliente** mostra il messaggio. WhatsApp/Chiama/Email si aprono con il testo giusto?
- [ ] **Assegna un tavolo** sulla pianta: i tavoli già presi da un'altra prenotazione con orario sovrapposto sono bloccati?
      Un secondo turno (21:00) può prendere lo stesso tavolo del primo (19:30 + 90')?
- [ ] Gruppo di 8: assegna due tavoli. Il messaggio sotto dice se i posti non bastano?
- [ ] In **Sala**, i tavoli prenotati mostrano ora e nome? Tocca il tavolo: compare «Prenotato» con **Arrivato**?
- [ ] **Arrivato**: si apre il conto con i coperti giusti, e la prenotazione risulta «Al tavolo»?
- [ ] **Non si è presentato** e **Annulla**: la prenotazione esce dai coperti del turno?
- [ ] Da telefono 📱: l'agenda si legge? Il pannello della prenotazione occupa lo schermo e si torna indietro?

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

- [ ] Come `kitchen`: l'ordine arriva da solo?
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

## M. Prenotazioni online (portale dei clienti)

- [ ] Impostazioni → Prenotazioni online: accendi, scrivi il telefono e un messaggio. Il QR e il link compaiono?
- [ ] Apri il link dal **telefono**: i quattro passi sono chiari? Un giorno senza posto è grigio?
- [ ] Invia una richiesta: arriva «Richiesta ricevuta» con un link? In Prenotazioni la vedi «Da confermare»?
- [ ] Conferma dall'agenda: dal link del cliente vedi «Prenotazione confermata»?
- [ ] Prova a inviare 3 richieste con lo stesso telefono: la terza viene respinta con un messaggio chiaro?
- [ ] Con 10 persone: il pulsante «+» si ferma e dice di telefonare?
- [ ] Annulla dal link: il posto torna libero?
- [ ] Segna «Arrivato», incassa il conto: la prenotazione diventa «Conclusa» e il tavolo si libera?

## N. Asporto

- [ ] Master → Nuovo locale → tipo «Solo asporto»: entrando vedi solo Asporto, Cucina, Carta, Statistiche e Impostazioni (niente Sala né Prenotazioni)?

- [ ] Impostazioni → Asporto: scrivi gli orari (per esempio 18:30–22:00), la capienza per fascia (12), accendi gli ordini online. Il QR compare?
- [ ] Nella Carta, un prodotto ha «Asporto: quanto impegna il forno»: la bibita a «Niente», la pizza a «Una porzione».
- [ ] Dal telefono apri `/order`: scegli prodotti, giorno e fascia, invia. In «Asporto» e nella campanella compare con il suono?
- [ ] Accetta: in cucina compare con «Ritiro hh:mm», il nome e il numero? Il cliente vede «Ordine confermato» da solo?
- [ ] Cucina «Pronta» → in lista «Pronto» → «Consegna e incassa»: il cliente vede «Ordine ritirato»?
- [ ] «Nuovo ordine» al banco e al telefono: la prima fascia libera è già scelta? Una fascia piena lo dice e chiede se forzare?
- [ ] Ordina 13 pizze in una fascia da 12: il sito dice che non c'è più posto?
- [ ] Rifiuta con un motivo: il cliente lo legge?

## O. Feedback

- [ ] Impostazioni → «Dicci cosa migliorare»: scrivi un messaggio per un modulo. Nel Master → Feedback compare?

## P. Avvisi WhatsApp (modo di prova)

Nel file `.env` del backend metti `WHATSAPP_DRIVER=mock`: i messaggi non escono, ma si vedono nel registro del Master.

- [ ] Master → Moduli del locale: accendi «Avvisi WhatsApp». Compare il pulsante «WhatsApp» sulla scheda del locale?
- [ ] Master → WhatsApp: eventi acceso/spento, tetto mensile, «Invia prova» con un tuo cellulare.
- [ ] Invia una prenotazione dal sito con un cellulare: in Prenotazioni, nel dettaglio, compare «Avvisi WhatsApp · Ricevuta · in coda»?
- [ ] Dopo 2 minuti passa a «inviato»; se la confermi prima, «Ricevuta» non parte e parte «Confermata»?
- [ ] Un fisso o un numero sbagliato: «numero non valido», nessun errore per il personale?
- [ ] Asporto: accetta → «Confermato»; la cucina segna «Pronta» → «Pronto»; annulla → «Annullato».
- [ ] Una richiesta lasciata senza risposta: scade (asporto a 10 minuti dal ritiro) e si vede «Scaduto»?

## Dopo la prova

Mandami le righe `[~]` e `[!]`. Per ogni problema mi bastano:

1. **dove** (es. «Sala, conto, dopo aver premuto Manda»);
2. **cosa ti aspettavi**;
3. **cosa è successo**.

Se puoi, uno **screenshot**. Poi li sistemo a gruppi, e rifacciamo solo le parti toccate.
