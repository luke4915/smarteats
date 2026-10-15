# Rilasci, ambienti e costi

Come si porta online una versione nuova senza rompere niente, e come si torna indietro se qualcosa va storto.
Per l'installazione passo passo (dominio, Railway, variabili) vedi `docs/deployment.md`; qui sta il **processo**.

## 1. Gli ambienti

| Ambiente | A cosa serve | Dove | Segue |
|---|---|---|---|
| **Sviluppo** | scrivere e provare | il tuo computer (`npm run dev`) | il ramo su cui lavori |
| **Prova** | provare la versione nuova con dati finti, anche da telefono, prima di metterla davanti ai clienti | online, indirizzo suo (es. `prova.miodominio.it`) con un **database separato** | il ramo `main` |
| **Produzione** | i locali veri | online, `miodominio.it` | il ramo `produzione` |

Perché due ambienti online: la prova si fa su un posto dove si può sbagliare. In produzione non si prova mai nulla
per la prima volta.

Finché non c'è nessun cliente vero, **si parte con la sola Prova**: la produzione si crea quando serve.

## 2. Come funzionano le versioni

Ogni versione ha un numero `MAGGIORE.MINORE.CORREZIONE` (es. `0.3.1`):

- **CORREZIONE** (`0.3.1` → `0.3.2`): si è sistemato un difetto, niente di nuovo.
- **MINORE** (`0.3.2` → `0.4.0`): c'è una funzione nuova, tutto il resto funziona come prima.
- **MAGGIORE** (`0.x` → `1.0.0`): un cambiamento che costringe i locali a cambiare modo di lavorare. Il `1.0.0` è il
  primo rilascio «da clienti veri».

Ogni rilascio è una **etichetta** (tag) su GitHub, `v0.4.0`, con le **note di rilascio**: cosa cambia, scritto per chi usa
l'app, non per chi scrive il codice. Le note stanno anche nel file `CHANGELOG.md` del repository.

## 3. Il flusso, passo per passo

```
ramo di lavoro ──PR──▶ main ──(automatico)──▶ PROVA ──(a mano, dopo la verifica)──▶ PRODUZIONE
```

1. **Si lavora su un ramo** e si apre una pull request verso `main`. La CI (`frontend`, `backend`) deve essere verde.
2. **Si unisce in `main`**: Railway rilascia da solo sulla **Prova**.
3. **Si verifica sulla Prova** con la lista corta qui sotto (5-10 minuti) e, per le novità grosse, con `docs/prova-a-mano.md`.
4. **Si rilascia in produzione**, solo quando la Prova è a posto:
   - si aggiorna la nota in `CHANGELOG.md` e si sceglie il numero di versione;
   - si mette l'etichetta: `git tag v0.4.0 && git push origin v0.4.0` e si crea la **Release** su GitHub con le note;
   - si fa avanzare il ramo di produzione: `git push origin main:produzione`;
   - Railway rilascia da solo in produzione.
5. **Si controlla** (lista «subito dopo» qui sotto).

Il ramo `produzione` si muove **solo** in avanti e **solo** a questo punto: non ci si lavora mai sopra.

## 4. Liste di controllo

**Prima di rilasciare in produzione**

- [ ] La Prova funziona con la versione che stai per rilasciare (giro completo: ordine → cucina → incasso).
- [ ] La CI di `main` è verde.
- [ ] Le **migrazioni** nuove sono tutte «additive» (vedi sotto).
- [ ] C'è un **backup** del database di produzione fatto adesso (lo scatta Railway o `backend/scripts/backup.sh`).
- [ ] **Nessun servizio in corso**: i telefoni e i tablet si aggiornano da soli e ricaricano la pagina (vedi sotto).
- [ ] `CHANGELOG.md` aggiornato e tag creato.

**Subito dopo**

- [ ] `https://miodominio.it/api/health/ready` risponde «ok».
- [ ] Accedi a un locale vero, apri la Sala o la Cassa, fai un ordine di prova e stornalo.
- [ ] I log di Railway non mostrano errori ripetuti.
- [ ] Se qualcosa non va: **torna indietro subito** (sotto), poi indaga.

## 5. Le migrazioni del database, la parte delicata

Il codice si può «tornare indietro» in un minuto, il database no: una colonna cancellata o dati trasformati non tornano.
Per questo la regola, già nel `CLAUDE.md`, è che ogni migrazione deve essere **additiva** nel rilascio in cui nasce:

- **Aggiungere** una tabella o una colonna: sì, in qualsiasi momento.
- **Togliere** o **cambiare il significato** di una colonna: si fa in **due rilasci**. Nel primo il codice smette di
  usarla (e si prova). Nel secondo, rilasci dopo, la migrazione la elimina.
- Una migrazione già applicata non si modifica mai: se ne scrive una nuova.

Così, se il rilascio va male, il codice vecchio gira ancora sul database nuovo, e il rollback dell'app è sicuro.

Il comando di rilascio di Railway (`preDeployCommand`) applica le migrazioni mancanti **prima** che parta il codice
nuovo; se una fallisce il rilascio si ferma e il codice vecchio resta in piedi.

## 6. Tornare indietro (rollback)

| Cosa è andato storto | Cosa si fa |
|---|---|
| L'app nuova ha un difetto grave | Su Railway → Deployments → **Redeploy** della versione precedente (un minuto). Poi si sistema con calma. |
| Il difetto è in `main` e va corretto | Ramo `fix/...`, PR, verde, `main` → Prova → produzione (flusso normale, più in fretta). Se serve subito: `git push origin <tag-precedente>:produzione --force`. |
| Una migrazione ha rovinato i dati | Si ripristina il **backup** scattato prima del rilascio. È l'ultima risorsa, ed è il motivo per cui il backup si fa **sempre** prima. |

## 7. Un dettaglio che riguarda i dispositivi

L'app è una PWA: i dispositivi la scaricano e la tengono. Con la configurazione attuale (`autoUpdate`), quando c'è una
versione nuova il dispositivo la prende e **ricarica la pagina**. Se un cameriere sta scrivendo una comanda in quel momento,
può perderla. Due conseguenze:

1. **I rilasci si fanno fuori dal servizio** (la mattina presto, o a locale chiuso).
2. Più avanti conviene mostrare un avviso «c'è una versione nuova» e lasciare la scelta a chi lavora. È una piccola
   modifica da fare prima della produzione vera.

## 8. Quanto costa

**Non è gratuito**, ma è poco. I numeri vengono da fonti terze e vanno verificati sul sito del servizio prima di
decidere ([Railway: prezzi](https://railway.com/pricing)).

| Voce | Costo indicativo | Note |
|---|---|---|
| Railway, piano base | circa 5 $/mese, con 5 $ di consumo inclusi | si paga a consumo oltre; il piano Pro parte da 20 $/mese |
| App + database Postgres piccoli | pochi $/mese di consumo | per 1-5 locali resta nell'ordine di 5-15 $/mese in totale (stima, da verificare dopo un mese reale) |
| Dominio | circa 10-15 €/anno | serve **tuo**, con DNS che permetta il «wildcard» `*.miodominio.it` |
| Prova (secondo ambiente) | qualche $ in più | si può tenere spento quando non serve |
| Invio email (se lo faremo) | di solito gratis sotto qualche migliaio di mail al mese | funzione aggiuntiva, vedi prenotazioni |

**Domini:** Railway accetta il dominio wildcard su un servizio (tutti i sottodomini vanno alla stessa app, che è
esattamente il nostro caso). Si aggiungono due record al DNS (un CNAME e un TXT di verifica); se usi Cloudflare, il
record di verifica non deve passare dal proxy.

**Alternativa più economica ma più manuale:** un server virtuale (VPS) da pochi euro al mese. Costa meno, ma tutto
(aggiornamenti di sicurezza, backup, certificati, riavvii) resta a carico tuo. Per iniziare, la piattaforma gestita
è la scelta più sicura.

## 9. Cosa manca ancora per questo processo

- [ ] Creare il progetto Railway (e l'ambiente Prova) e collegarlo a `main`. *Serve il tuo account.*
- [ ] Il ramo `produzione` e una regola di protezione (solo avanzamenti).
- [ ] `CHANGELOG.md` con la prima voce, e la prima etichetta `v0.1.0`.
- [ ] Mostrare il numero di versione nell'app (in Impostazioni) e in `/api/health`, per sapere cosa gira dove.
- [ ] L'avviso «c'è una versione nuova» al posto del ricaricamento automatico (sezione 7).
- [ ] Verificare che i backup automatici del database siano attivi nel piano scelto, e fare una prova di ripristino.
