# Magazzino: scorte, ingredienti, fornitori e margini — disegno

Stato: **approvato**, in realizzazione a fasi (25 ottobre 2026). Decisioni prese con Luca il 25 ottobre 2026.

## 1. Cosa risolve

Oggi un piatto ha un numero «disponibili» che si azzera a ogni servizio (torna illimitato). Non si sa cosa c'è in dispensa, quanto costa un
piatto, quanto si guadagna davvero. Il magazzino lo fa in tre gradini, uno dentro l'altro:

| Modalità | A cosa serve | Cosa c'è |
|---|---|---|
| **Spento** | come oggi | tutto illimitato |
| **Porzioni** (semplice) | «oggi ne ho 40» | un conteggio per piatto, con azzeramento a ogni servizio |
| **Magazzino** (avanzato) | sapere cosa c'è, cosa costa, cosa si guadagna | ingredienti, fornitori, carichi di merce, costi, margini; gli ingredienti si scalano dalle **ricette** oppure con lo **scarico semplificato** |

È un **modulo** (`inventory`) per **tutti** i tipi di locale (sagre, ristoranti, solo asporto). È una funzione **a pagamento**: lo accende e sceglie la
modalità **solo il master** (da «Gestisci» → Moduli), insieme al modo di scalare gli ingredienti (ricette o scarico semplificato); l'admin del locale non li cambia. Spento = il modulo non c'è.

## 2. Come funziona

### Porzioni (azzeramento a ogni servizio)
Ogni piatto ha una **regola di azzeramento**, scelta nella Carta:
- **Riparti da N a ogni servizio** (predefinita quando si attivano le porzioni): all'**apertura del servizio** la disponibilità torna a N.
- **Continua dal servizio prima**: non si tocca (una torta fatta per due giorni).
- **Illimitato**: come oggi.

Il servizio (la «sessione») è il confine: lo stesso criterio dei conti e degli incassi. Quando un piatto arriva a zero si nasconde, come ora.
Una modifica a mano del numero del giorno resta sempre possibile (è arrivata altra merce).

### Magazzino (ingredienti)
- **Gli ingredienti non si azzerano mai.** Sono la dispensa vera: i 10 kg di farina del lunedì, se ne vendi 3 kg, sono 7 kg anche il martedì. Cambiano
  solo con un **carico** (arriva merce), una **vendita**, uno **scarto** o un **conteggio** (si conta e si corregge). Cosa si azzera a ogni servizio
  sono solo le porzioni dei piatti; si possono usare insieme (es. «al massimo 20 oggi», anche se la dispensa ne permetterebbe 30).
- **Ricetta** di un piatto: elenco di ingredienti con la quantità, oppure di **preparazioni** (es. il sugo base, usato in più piatti, con una sua ricetta).
- Una **vendita** scala gli ingredienti della ricetta. Una **opzione** del piatto («extra mozzarella», «senza cipolla») può aggiungere o togliere
  ingredienti; si può spegnere per ogni opzione.
- La disponibilità di un piatto è **la più bassa** fra le sue porzioni rimaste e quanto permettono gli ingredienti. Quando manca un ingrediente i
  piatti che lo usano diventano non ordinabili (avviso in cassa e sala); **admin e responsabile possono forzare la vendita**.
- **Storno:** si può stornare sempre, anche con la cucina già partita. Se la comanda non è partita gli ingredienti tornano in dispensa; se è
  partita chi storna sceglie fra **rimetti in dispensa** e **registra come scarto**.
- **Cucina:** con un tocco segna un piatto o un ingrediente **esaurito**.
- **Asporto e ordini dal sito:** il cliente non può ordinare ciò che è finito né in un giorno di chiusura; per i giorni dopo gli ingredienti si scalano
  il **giorno del ritiro** (come già fatto per l'asporto).
- **Scorta minima** per ingrediente: sotto soglia compare un avviso nella campanella e l'ingrediente entra in «Da riordinare».

### Scarico semplificato (per chi non vuole le ricette: tipico di una sagra)
Il master sceglie per il locale **come si scalano gli ingredienti**:
- **Dalle ricette** (automatico): ogni vendita scala gli ingredienti del piatto. Dà i margini per piatto e il confronto teorico/reale.
- **Scarico semplificato** (manuale): niente ricette. A fine servizio (o quando serve) una schermata «Scarico» elenca gli ingredienti con la quantità in dispensa; per ognuno si scrive
  **quanto è stato usato** oppure **quanto è rimasto** (l'altro si calcola). Scrive un movimento di tipo `usage` nel registro. Il costo del servizio è il consumo × costo medio;
  il margine per piatto non si calcola (non c'è la ricetta), ma food cost e valore del magazzino sì. Si può passare dall'uno all'altro modo senza perdere i dati.

### Fornitori e carichi di merce
- **Fornitore:** nome, telefono, email, partita IVA, note. Un ingrediente può avere **più fornitori**, ognuno con la sua confezione e il suo prezzo
  («Rossi: cassa da 12 bottiglie, 18,00 €»).
- **Conversioni:** l'ingrediente ha una **unità di base** (grammi, millilitri, pezzi); la confezione dice quante unità di base contiene. Così si compra a
  casse e si usa a grammi. La **resa** (1 kg di carne → 800 g utilizzabili) è facoltativa, in percentuale.
- **Carico di merce** (la «bolla»): data, fornitore, numero del documento, righe (ingrediente, quantità, costo, IVA) e **foto o file della bolla**
  allegato. Si inserisce a mano. Al salvataggio gli ingredienti salgono e il **costo medio ponderato** si aggiorna.
- **Foto della bolla:** da iPhone e iPad il normale selettore del file offre la fotocamera e «Scansiona documenti» (nessun codice nativo, da provare su un
  dispositivo vero); da computer si carica il file. I documenti stanno nel database (stesso backup, stessa isolamento fra locali), max 8 MB, immagini
  ridotte prima dell'invio.
- Costi sempre **senza IVA**, in centesimi interi sul server. L'IVA si registra riga per riga.

### Fiscalità di base (solo preparazione, nessuno scontrino fiscale)
Ogni prodotto ha un'**aliquota IVA di vendita** (predefinita del locale, impostabile: 4, 5, 10, 22 % per l'Italia, elenco configurabile) e ogni riga di carico
la sua. I prezzi in carta restano **con IVA**; i report calcolano ricavi, costi e margini **al netto**. Il resto della fiscalità (registratore, fatture) resta fuori.

### Metriche (il valore del magazzino)
Per servizio, per periodo e per piatto (**prodotto** in SmartEats Stand: le parole le dà `utils/terms.js`):
- **Food cost** (costo del venduto in % del ricavo netto) e **margine** per piatto o prodotto e per servizio;
- **Valore del magazzino** (euro in dispensa) e **giorni di scorta** rimasti per ingrediente;
- **Spesa per fornitore** e **andamento dei prezzi** (chi ha alzato il prezzo);
- **Teorico contro reale**: quanto doveva scalare (vendite × ricette) contro quanto risulta da un **controllo di magazzino** (`stock_level`); la differenza in unità e in euro dice dove si perde;
- **Scarti**: valore e quantità per motivo (rotto, scaduto, staff, omaggio, ordine stornato).
Rimandate: la «matrice» popolarità/margine dei piatti (menu engineering) e l'ora di esaurimento.

## 3. Chi può cosa
| | admin | responsabile | cassa, cameriere | cucina |
|---|---|---|---|---|
| Vede la disponibilità dei piatti | sì | sì | sì | sì |
| Gestisce ingredienti, ricette, fornitori, carichi, conteggi, scarti | sì | sì | no | no |
| Vede costi e margini | sì | sì | no | no |
| Forza la vendita di un piatto esaurito | sì | sì | no | no |
| Segna esaurito un piatto o un ingrediente | sì | sì | no | sì |
| Accende il modulo e sceglie la modalità | **solo il master** | | | |

## 4. Dati (un'unica migrazione, 056)
Tutte le tabelle sono del locale: `tenant_id`, RLS con `NULLIF(...)`, e in `TENANT_SCOPED_TABLES` (`routes/master.js`). Nomi dal glossario (sezione 6).

| Tabella | A cosa serve |
|---|---|
| `ingredients` | `name` (unico senza maiuscole), `base_unit` (`g`, `ml`, `pc`), `yield_percent`, `reorder_level`, `quantity_on_hand`, `average_cost` (per unità di base, in centesimi con decimali), `marked_out`, `active` |
| `suppliers` | `name`, `phone`, `email`, `vat_number`, `notes`, `active` |
| `supplier_ingredients` | quali ingredienti vende un fornitore: `purchase_unit_name` («cassa da 12»), `base_units_per_purchase_unit`, `unit_cost_cents`, `vat_rate` |
| `goods_receipts` | un carico: `supplier_id`, `received_on`, `document_number`, `notes`, `total_cost_cents`, `created_by` |
| `goods_receipt_lines` | le righe: `ingredient_id`, `quantity` in confezioni, `base_quantity`, `unit_cost_cents`, `vat_rate`, `line_cost_cents` |
| `stored_documents` | le foto/file delle bolle: `goods_receipt_id`, `file_name`, `content_type`, `size_bytes`, `data` (bytea, max 8 MB) |
| `preparations` | preparazioni riusabili (sugo base): `name`, `base_unit`, `output_quantity` |
| `recipe_lines` | ricetta di un piatto **o** di una preparazione: l'ingrediente **o** la preparazione usata, e la quantità; un vincolo impone «un solo proprietario, un solo componente» |
| `modifier_recipe_lines` | cosa cambia un'opzione: ingrediente e variazione in più o in meno |
| `ingredient_movements` | **il registro** (non si cancella): `ingredient_id`, `kind` (`receipt`, `sale`, `sale_reversal`, `usage`, `waste`, `adjustment`, `stock_level`), `quantity_change`, `unit_cost`, `reason`, riferimento (ordine, carico, conteggio), `session_id`, `created_by` |
| `stock_levels`, `stock_level_lines` | un **controllo di magazzino**: quanto atteso, quanto contato, la differenza; confermandolo si scrivono le correzioni nel registro |

Colonne nuove su tabelle esistenti:
- `products`: `portions_reset_rule` (`restart_each_service`, `carry_over`, `unlimited`), `portions_start`, `vat_rate`; la `stock`/`stock_enabled` di oggi diventano le porzioni rimaste;
- `modifiers`: `affects_stock` (acceso di default);
- `order_items`: `cost_cents` (costo teorico della riga **al momento della vendita**, per i margini senza ricalcoli);
- impostazioni: `inventory_mode` (`portions`/`warehouse`) e `inventory_depletion` (`recipes`/`simple`), scritte solo dal master, e `default_vat_rate`.

**Come si tiene giusta la quantità:** `quantity_on_hand` si aggiorna nella stessa transazione del movimento, con l'ingrediente bloccato (`FOR UPDATE`, in ordine di id, come `utils/stock.js` per i prodotti). Un test verifica che la somma del registro e la quantità coincidano.

**Prerequisito da sistemare:** oggi modificare un gruppo di opzioni **cancella e ricrea** le opzioni (cambiano gli `id`): un collegamento con gli ingredienti si perderebbe. Il salvataggio passa ad **aggiornare le opzioni esistenti per `id`** (e creare/togliere solo ciò che serve).

## 5. Come si organizza il lavoro
Una sola migrazione (056) e il codice in fasi, ognuna una PR con i suoi test mirati e la sua riga di changelog; il ciclo completo a fine di ogni fase.

| Fase | Contenuto |
|---|---|
| 1 | **Realizzata.** Migrazione, modulo `inventory` e modalità (master), porzioni con azzeramento a ogni servizio, opzioni con `id` stabili |
| 2 | **Realizzata.** Ingredienti, preparazioni e ricette; scarico alle vendite e storni; piatti esauriti; «esaurito» dalla cucina |
| 3 | **Realizzata.** Fornitori, carichi di merce con foto o scansione della bolla, costo medio, IVA |
| 4 | **Realizzata.** Controlli di magazzino, scarti e rettifiche, scarico semplificato; report: food cost, margini, teorico contro reale, valore del magazzino. IVA per prodotto e predefinita del locale |
| 5 | Scorta minima e «Da riordinare», giorni di scorta, spesa per fornitore, andamento dei prezzi |

**Struttura del codice** (leggibile e mantenibile): logica pura in file piccoli con test (`utils/inventory/`: `portions.js`, `recipeCost.js`, `availability.js`,
`unitConversion.js`, `weightedAverageCost.js`), accesso ai dati separato (`utils/inventory/*Db.js`), una route per tema (`ingredients`, `suppliers`,
`goodsReceipts`, `recipes`, `stockCounts`, `inventoryReports`), schemi `zod` in `schemas/inventorySchema.js`. Frontend in `frontend/src/inventory/` (usato da
SmartEats Stand e Restaurant), una cartella per tema, nessun file oltre le 300 righe. Voce di menu **Magazzino** (admin e responsabile), con schede.

## 6. Glossario (nomi nel codice)
| Italiano | Nel codice |
|---|---|
| magazzino, scorte | `inventory` |
| porzioni | `portions` |
| ingrediente | `ingredient` |
| preparazione (sugo base) | `preparation` |
| ricetta | `recipe` (riga: `recipe_line`) |
| fornitore | `supplier` |
| bolla di consegna | `delivery_note` (il file) |
| carico di merce | `goods_receipt` |
| movimento | `stock_movement` |
| scarto | `waste` |
| rettifica | `adjustment` |
| controllo di magazzino (conteggio fisico) | `stock_level` |
| scorta minima | `reorder_level` |
| resa | `yield_percent` |
| unità di base / confezione | `base_unit` / `purchase_unit` |
| costo medio ponderato | `weighted_average_cost` |
| food cost | `food_cost` |
| teorico / reale | `theoretical` / `actual` |
| IVA | `vat` |

## 7. Dati riservati (trasversale, una PR a parte, prima delle fasi 3 e 4)
Un livello in più di privacy per i numeri delicati: **costi, margini, food cost, prezzi dei fornitori, valore del magazzino e le statistiche di incasso**. Finché sono
«riservati» non si vedono: al posto dei numeri compaiono cifre e codici a caso (sfocati). Si sbloccano con la **password di un amministratore**, per pochi minuti.
- **Vale sul server, non solo sulla grafica:** da bloccati, gli endpoint di quei dati **non mandano i valori** (campi vuoti e `locked: true`); la grafica disegna cifre finte. Altrimenti basterebbe aprire gli strumenti del browser. Anche l'esportazione (CSV, PDF) si blocca.
- **Sblocco:** `POST /auth/unlock-reserved-data` con la password di **un** amministratore del locale (la verifica e non la salva; limitatore di tentativi); sblocca **la sessione di chi la chiede** per 10 minuti e si registra nell'audit (chi ha sbloccato, quale amministratore ha autorizzato). L'amministratore può digitarla sul dispositivo del responsabile senza dargliela.
- **Chi lo accende:** l'admin del locale, da Impostazioni (impostazione `reserved_data_lock`). Spento di partenza.
- Riguarda anche le statistiche che esistono già (cassa e ristorante), non solo il magazzino.

## 8. Da fare in futuro (predisposto, non realizzato)
- **Lotti e scadenze** (tracciabilità HACCP): i movimenti hanno già un riferimento a cui agganciare un lotto.
- Lettura **automatica** della bolla dalla foto (OCR) e importazione della **fattura elettronica**.
- Matrice popolarità/margine dei piatti (menu engineering) e suggerimento di riordino dai consumi.
- Più sedi con magazzino condiviso.

## 9. Da confermare
1. **Storno:** la scelta «rimetti in dispensa / scarto» solo se la cucina è già partita, automatico altrimenti (sezione 2).
2. **Documenti nel database** (bytea, 8 MB) invece che su disco: un solo backup; si cambia se i documenti diventano molti.
3. **Costo medio ponderato** come metodo di costo.
4. **Costi e margini** visibili ad admin e responsabile (non alla cassa).
5. **Aliquote IVA** predefinite 4 / 5 / 10 / 22 e prodotto con IVA di vendita 10 % come impostazione del locale.
6. **Scarico semplificato:** lo sceglie il master (non l'admin del locale), insieme alla modalità.
7. **Dati riservati:** sblocco con la password di un amministratore (non un codice a parte), 10 minuti, solo per la sessione di chi lo chiede.
