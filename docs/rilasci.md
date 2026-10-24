# Rilasci

Come si porta online una versione nuova senza rompere niente, e come si torna indietro.
L'installazione del server (Oracle, DuckDNS, Docker) è in `docs/deployment.md`; qui sta il **processo**.

## 1. Gli ambienti

| Ambiente | Dove | A cosa serve |
|---|---|---|
| **Sviluppo e prova** | il tuo Mac | `npm run dev`, `./scripts/check.sh --all` (test, e2e con screenshot) e `./scripts/avvia.command` per provare l'app «vera» con il locale `demo`. |
| **Produzione** | il server Oracle (`deploy/`) | i locali veri. Niente si prova qui per la prima volta. |

Una «Prova» online separata non serve finché il server è una VM da 1 GB. Quando ci saranno clienti veri, si aggiunge
un secondo stack sullo stesso server con un altro sottodominio.

## 2. Il numero di versione

`MAGGIORE.MINORE.CORREZIONE` (es. `0.3.1`):

- **CORREZIONE** (`0.3.1` → `0.3.2`): un difetto sistemato, niente di nuovo.
- **MINORE** (`0.3.2` → `0.4.0`): una funzione nuova, il resto funziona come prima.
- **MAGGIORE** (`0.x` → `1.0.0`): cambia il modo di lavorare dei locali. L'`1.0.0` è il primo rilascio «da clienti veri».

Il numero sta in **tre posti che devono coincidere**: `frontend/package.json` (`version`), l'etichetta git `vX.Y.Z` e la
prima voce di `frontend/src/changelog.js`. Lo controllano `changelog.test.js` (primi due) e il workflow **Rilascio**
(etichetta e `package.json`): se non coincidono, il rilascio si ferma prima di costruire l'immagine.

## 3. Il flusso

```
ramo ──PR──▶ main ──versione + changelog──▶ tag vX.Y.Z ──▶ immagine su GHCR ──▶ server: pull + up
```

1. **Si lavora su un ramo** e si apre una PR verso `main`. La CI (`frontend`, `backend`) deve essere verde.
2. **Si unisce in `main`.** Non succede nulla sul server.
3. **Si prepara il rilascio**, quando si decide di pubblicare:
   - si alza `version` in `frontend/package.json` (e nel suo `package-lock.json`);
   - si aggiunge in cima a `frontend/src/changelog.js` la voce con 2-4 righe per chi usa l'app (è ciò che admin e
     responsabili vedranno nella finestra «Novità»; correzioni minuscole possono non averla, ma la voce di
     testa deve sempre coincidere con la versione);
   - `./scripts/check.sh --all` verde, commit `chore(release): v0.3.0`, merge in `main`.
4. **Si mette l'etichetta:** `git tag v0.3.0 && git push origin v0.3.0`. Il workflow costruisce l'immagine
   (amd64 + arm64) e la pubblica; si segue su GitHub → Actions (qualche minuto).
5. **Si aggiorna il server** (vedi la lista qui sotto).
6. **Si controlla** che funzioni e si crea la Release su GitHub con le stesse righe del changelog.

## 4. Sul server

**Prima** (fuori dal servizio: ci sono pochi secondi di fermo)

- [ ] L'immagine nuova è pubblicata (workflow verde).
- [ ] Se tra le novità c'è una **migrazione**, un backup fatto adesso: `docker compose exec backup bash /backup.sh /backups 14`.
- [ ] Sai qual è la versione che gira ora (serve per tornare indietro): `docker compose images app`.

**Aggiornamento**

```
ssh -i ~/oracle_smarteats.key ubuntu@<ip riservato>
cd stand-manager/deploy
docker compose pull app && docker compose up -d app
docker compose logs -f app        # deve finire con «in ascolto»; Ctrl+C per uscire
```

Le migrazioni mancanti girano da sole all'avvio. Per fissare una versione precisa invece di `latest`, in `.env`:
`APP_IMAGE=ghcr.io/luke4915/stand-manager:0.3.0`.

**Dopo**

- [ ] `https://<nome>.duckdns.org/api/health/ready` risponde «ok».
- [ ] Entra in un locale vero, apri la Sala o la Cassa, fai un ordine di prova e stornalo.
- [ ] Nei log (`docker compose logs --since 10m app`) non ci sono errori ripetuti.

## 5. Cosa vedono i dispositivi

L'app è una PWA: telefoni e tablet la tengono in memoria. Quando c'è una versione nuova succede questo, **senza mai
perdere ordini**:

1. Ogni 30 minuti, e a ogni ritorno in primo piano, il dispositivo controlla se c'è una versione nuova e la scarica in disparte.
2. In alto compare «Nuova versione disponibile · Aggiorna»: chi lavora la applica quando vuole.
3. Se nessuno la tocca, si applica da sola solo in momenti sicuri: quando l'app torna in primo piano dopo almeno 5 minuti
   di pausa, oppure (cassa sempre aperta) dopo 6 ore di attesa **e** 5 minuti di schermo fermo.
4. **Mai** con ordini in coda offline o stampe non ancora partite.
5. Dopo l'aggiornamento, admin e responsabili vedono una volta sola la finestra **Novità** con le righe del changelog.
   Non esiste un archivio da riaprire; il primo accesso su un dispositivo nuovo non mostra niente.

Quindi un rilascio a metà servizio non rompe nulla, ma conviene farlo lo stesso a locale chiuso.
Regole in `frontend/src/utils/updatePolicy.js` (con test).

## 6. Le migrazioni, la parte delicata

Il codice si riporta indietro in un minuto, il database no. Per questo una migrazione deve essere **additiva** nel
rilascio in cui nasce, così il codice vecchio gira ancora sul database nuovo e il rollback è sicuro:

- **Aggiungere** una tabella o una colonna: sempre.
- **Togliere** o **cambiare il significato** di una colonna: in **due rilasci**. Nel primo il codice smette di usarla;
  nel secondo, dopo, la migrazione la elimina (con backup).
- Una migrazione già applicata non si modifica mai: se ne scrive una nuova.

## 7. Tornare indietro

| Cosa è andato storto | Cosa si fa |
|---|---|
| L'app nuova ha un difetto grave | In `.env` `APP_IMAGE=ghcr.io/luke4915/stand-manager:<versione precedente>`, poi `docker compose up -d app` (un minuto). I dispositivi tornano alla versione vecchia come per un aggiornamento. |
| Il difetto va corretto | Ramo `fix/…`, PR, verde, nuova versione `CORREZIONE` col flusso normale. |
| Una migrazione ha rovinato i dati | Ripristino del backup scattato prima (`docs/deployment.md`, «Backup e ripristino»). È l'ultima risorsa: per questo il backup precede sempre una migrazione. |

## 8. Cosa manca

- [ ] Backup copiati fuori dal server e prova di ripristino (rimandati finché ci sono solo prove).
- [ ] Monitor gratuito sull'indirizzo `/api/health/ready` (idem).
- [ ] Mostrare la versione nell'app e in `/api/health`, per sapere cosa gira dove.
