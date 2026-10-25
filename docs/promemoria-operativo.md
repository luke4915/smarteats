# Promemoria operativo

Una pagina da tenere sottomano per gestire il server di produzione. Niente segreti qui dentro: password, chiave SSH e file `.env` stanno nel gestore di password.
Per il processo completo di rilascio vedi `docs/rilasci.md`; per l'installazione `docs/deployment.md`.

## 1. Dove sta cosa

| Cosa | Dove | Note |
|---|---|---|
| App e console master | `https://<nome>.duckdns.org/master` | `<nome>` è il nome scelto su DuckDNS; ogni locale è `<locale>.<nome>.duckdns.org` |
| Server | Oracle Cloud → Compute → Instances | istanza E2.1.Micro, Ubuntu; l'IP pubblico è **riservato** (Networking → Reserved public IP) |
| Regole di rete | Oracle → VCN → Security List | porte aperte: 22, 80, 443 |
| Dominio | duckdns.org | il token serve a Traefik per il certificato: sta nel `.env` del server |
| Stato del server | uptimerobot.com | controlla `/api/health/ready` ogni 5 minuti e scrive per email |
| Codice, PR, rilasci | GitHub → `luke4915/stand-manager` | Actions = CI e rilasci; Packages = immagine |
| Chiave SSH | `~/oracle_smarteats.key` | **copia fuori dal Mac**: se si perde non si entra più |

## 2. Entrare nel server

```
ssh -i ~/oracle_smarteats.key ubuntu@<IP riservato>
cd stand-manager/deploy
```

Tutti i comandi qui sotto si lanciano da `~/stand-manager/deploy`.

## 3. Comandi di tutti i giorni

| Cosa voglio | Comando |
|---|---|
| Vedere cosa gira | `docker compose ps` (tutto deve essere «Up»; `app` anche «healthy») |
| Log dell'app, in diretta | `docker compose logs -f app` (esci con Ctrl+C) |
| Ultimi 10 minuti di log | `docker compose logs --since 10m app` |
| Riavviare solo l'app | `docker compose restart app` |
| Aggiornare alla versione nuova | `docker compose pull app && docker compose up -d app` |
| Tornare a una versione precedente | in `.env` `APP_IMAGE=ghcr.io/luke4915/stand-manager:0.2.0`, poi `docker compose up -d app` |
| Quale versione gira | `docker compose images app` |
| Spazio sul disco | `df -h /` e `docker system df` |
| Memoria | `free -h` |

## 4. Backup

- Un dump automatico ogni notte alle 03:00 in `deploy/backups/`, tenuto 14 giorni.
- **Prima di una migrazione**, a mano: `docker compose exec backup bash /backup.sh /backups 14`
- I backup stanno sullo stesso disco del server: non bastano. Copiali fuori (guida in `docs/deployment.md`, «Backup e ripristino», dove c'è anche il ripristino).

## 5. Se qualcosa non va

**Mi arriva la mail «Down» di UptimeRobot**
1. Apri l'indirizzo dal telefono, con la rete mobile: se funziona, era un problema momentaneo.
2. Entra col SSH. Se non entra, il server è spento o irraggiungibile: controlla l'istanza su Oracle (stato «Running»?) e riavviala da lì.
3. `docker compose ps`: se un servizio non è «Up», `docker compose up -d`.
4. `docker compose logs --since 10m app`: cerca l'errore. Se è dopo un aggiornamento, torna alla versione precedente (sezione 3).

**«Il sito non si apre» solo a me o a un locale**
- Il sottodominio del locale esiste? Controlla da `/master` che il locale sia attivo e con la licenza valida.
- Certificato scaduto o non emesso: `docker compose logs traefik | tail -50`. Il rinnovo è automatico; il token DuckDNS nel `.env` deve essere valido.

**Dopo un riavvio dell'istanza l'indirizzo è cambiato**
- Con l'IP riservato non deve succedere. Se succede, aggiorna l'IP su duckdns.org.

**Disco pieno**
- `docker system prune -f` toglie le immagini vecchie (non tocca i dati del database). Poi controlla `deploy/backups/`.

**Oracle ritira la macchina**
- Oracle può recuperare le istanze gratuite rimaste inattive per giorni (CPU e rete sotto una soglia bassa): un monitor che la interroga **non** lo impedisce. Con clienti veri non succede; durante le prove senza traffico sì. Dopo il ritiro serve ricreare l'istanza e ripristinare un backup.

## 6. Dopo ogni aggiornamento

- [ ] `https://<nome>.duckdns.org/api/health/ready` risponde «ok»
- [ ] entra in un locale vero, apri la Sala o la Cassa, fai un ordine di prova e stornalo
- [ ] nei log non ci sono errori ripetuti

## 7. Preferiti di Safari consigliati

Una cartella «SmartEats» con: console master, Oracle Cloud, DuckDNS, UptimeRobot, GitHub (repository, Actions, Packages). Gli accessi si salvano nel gestore di password, non nei preferiti.
