import { useEffect, useState } from 'react';
import { apiFetch } from '../utils/apiClient';
import { PublicShell } from '../components/public/PublicShell';
import Loading from '../components/shared/Loading';

// Informativa privacy e condizioni d'uso (`/privacy`, `/terms`): pagine pubbliche, uguali per tutti i locali. Chi fornisce
// il servizio (nome, email) arriva dal server (`LEGAL_*`). Il titolare del trattamento è il locale; il fornitore agisce
// per suo conto (responsabile, art. 28 GDPR). Registro volutamente formale, articolato in articoli e commi come un testo contrattuale.
// Ogni affermazione sul funzionamento corrisponde al comportamento reale del servizio (conservazione dei dati: `utils/bookingRetention.js`;
// pagamenti: `docs/design-pagamenti.md`); i riferimenti normativi sono quelli vigenti. Da far rivedere a un professionista prima del lancio.
const UPDATED = '1 novembre 2026';

const Art = ({ n, title, children }) => (
  <section className="mt-7">
    <h2 className="text-base font-semibold mb-2">Art. {n} — {title}</h2>
    <ol className="list-decimal pl-5 space-y-2 marker:text-[var(--text-muted)]">{children}</ol>
  </section>
);
const C = ({ children }) => <li className="text-sm leading-relaxed text-[var(--text-muted)] pl-1">{children}</li>;
const Sub = ({ children }) => <ul className="list-[lower-alpha] pl-5 mt-1.5 space-y-1 marker:text-[var(--text-muted)]">{children}</ul>;
const L = ({ children }) => <li className="text-sm leading-relaxed text-[var(--text-muted)] pl-1">{children}</li>;
const Mail = ({ legal }) => <a className="text-[var(--accent)] font-medium" href={`mailto:${legal.email}`}>{legal.email}</a>;

const Privacy = ({ legal }) => {
  const who = legal.name || 'il fornitore del servizio SmartEats';
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Informativa sul trattamento dei dati personali</h1>
      <p className="text-sm text-[var(--text-muted)] mt-1">resa ai sensi dell'art. 13 del Regolamento (UE) 2016/679 («GDPR») · ultimo aggiornamento: {UPDATED}</p>

      <Art n="1" title="Titolare e responsabile del trattamento">
        <C>Titolare del trattamento è il locale al quale viene indirizzata la richiesta di prenotazione o di ordine da asporto, i cui estremi sono indicati nella pagina da cui la richiesta è inviata. Il titolare determina le finalità e i mezzi del trattamento.</C>
        <C>{who} fornisce al titolare la piattaforma software SmartEats e, in tale veste, tratta i dati per conto e secondo le istruzioni del titolare, in qualità di responsabile del trattamento ai sensi dell'art. 28 GDPR.</C>
      </Art>

      <Art n="2" title="Dati trattati">
        <C>Sono trattati i seguenti dati:
          <Sub>
            <L>dati identificativi e di contatto: nome e numero di telefono (obbligatori); indirizzo di posta elettronica (facoltativo);</L>
            <L>dati relativi alla richiesta: data, orario e numero di persone; per l'asporto, i prodotti scelti, l'importo e l'orario di ritiro; le eventuali note;</L>
            <L>dati di navigazione: indirizzo IP, data e ora della richiesta, registrati per finalità di sicurezza.</L>
          </Sub>
        </C>
        <C>Il campo «note» è a testo libero. Le informazioni ivi inserite relative a allergie o intolleranze possono rivelare lo stato di salute (art. 9 GDPR): inserendole, l'interessato ne autorizza espressamente il trattamento al solo fine di dare esecuzione alla richiesta. Ne è sconsigliato l'inserimento al di fuori di tale scopo.</C>
      </Art>

      <Art n="3" title="Finalità e basi giuridiche">
        <C>I dati sono trattati per le seguenti finalità:
          <Sub>
            <L>gestione della richiesta e comunicazioni di servizio sul suo stato (ricezione, conferma, preparazione, annullamento), anche mediante messaggi WhatsApp al numero indicato: base giuridica è l'esecuzione di misure precontrattuali e di un contratto di cui l'interessato è parte (art. 6, par. 1, lett. b, GDPR);</L>
            <L>sicurezza dei sistemi e prevenzione di abusi: legittimo interesse del titolare e del responsabile (art. 6, par. 1, lett. f, GDPR);</L>
            <L>invio di messaggi di ringraziamento e di novità da parte del locale: consenso dell'interessato (art. 6, par. 1, lett. a, GDPR), prestato mediante apposita casella facoltativa.</L>
          </Sub>
        </C>
        <C>Il consenso di cui al comma 1, lett. c), è revocabile in qualsiasi momento, senza pregiudizio per la liceità del trattamento effettuato prima della revoca (art. 7, par. 3, GDPR). Gli avvisi WhatsApp possono essere interrotti rispondendo «STOP» a uno qualsiasi di essi.</C>
        <C>Il conferimento di nome e numero di telefono è necessario per dare seguito alla richiesta; in caso di rifiuto la richiesta non può essere gestita. Gli altri dati sono facoltativi.</C>
        <C>Non è svolta alcuna attività di profilazione né sono adottate decisioni basate unicamente su un trattamento automatizzato (art. 22 GDPR): ogni richiesta è valutata e confermata dal personale del locale.</C>
      </Art>

      <Art n="4" title="Destinatari dei dati e trasferimenti">
        <C>I dati sono accessibili al personale autorizzato del locale e, per le sole attività necessarie all'erogazione del servizio, al fornitore della piattaforma e ai suoi fornitori di infrastruttura (hosting).</C>
        <C>Per l'invio dei messaggi WhatsApp i dati necessari alla consegna sono comunicati a Meta Platforms Ireland Limited, che agisce quale fornitore del servizio di messaggistica. Qualora il locale abiliti il pagamento online con carta, il pagamento è gestito da Stripe Payments Europe Limited: i dati della carta sono inseriti direttamente nella pagina di Stripe e non transitano né sono conservati dai sistemi di SmartEats.</C>
        <C>L'utilizzo di tali fornitori può comportare il trasferimento di dati verso Paesi non appartenenti allo Spazio economico europeo; in tal caso il trasferimento avviene nel rispetto degli artt. 44 e seguenti del GDPR, sulla base di una decisione di adeguatezza o di clausole contrattuali tipo. I dati non sono ceduti a terzi né utilizzati per finalità pubblicitarie.</C>
      </Art>

      <Art n="5" title="Periodo di conservazione">
        <C>I dati identificativi, di contatto e le note sono cancellati decorsi 90 giorni dalla data della prenotazione o del ritiro. Successivamente permangono unicamente dati aggregati e anonimi (numero di coperti, numero di ordini) utilizzati per le statistiche del locale, dai quali non è possibile risalire all'interessato.</C>
        <C>Restano ferme le diverse conservazioni imposte da obblighi di legge a carico del titolare, in particolare di natura fiscale e contabile.</C>
      </Art>

      <Art n="6" title="Diritti dell'interessato">
        <C>L'interessato può esercitare i diritti di cui agli artt. 15-22 GDPR: accesso, rettifica, cancellazione, limitazione del trattamento, portabilità e opposizione. Le richieste possono essere rivolte al locale{legal.email && <> oppure a <Mail legal={legal} /></>}.</C>
        <C>L'interessato ha altresì diritto di proporre reclamo all'autorità di controllo, il Garante per la protezione dei dati personali (www.garanteprivacy.it), ai sensi dell'art. 77 GDPR.</C>
      </Art>

      <Art n="7" title="Cookie e strumenti di tracciamento">
        <C>Il sito non utilizza cookie di profilazione né altri strumenti di tracciamento. Sono impiegati esclusivamente strumenti tecnici strettamente necessari al funzionamento delle pagine, per i quali non è richiesto il consenso ai sensi dell'art. 122 del D.Lgs. 196/2003 («Codice in materia di protezione dei dati personali»).</C>
      </Art>

      <Art n="8" title="Modifiche">
        <C>La presente informativa può essere aggiornata; la versione vigente è sempre quella pubblicata su questa pagina, con l'indicazione della data di ultimo aggiornamento.</C>
      </Art>
    </>
  );
};

const Terms = ({ legal }) => (
  <>
    <h1 className="text-2xl font-semibold tracking-tight">Condizioni generali d'uso</h1>
    <p className="text-sm text-[var(--text-muted)] mt-1">delle pagine di prenotazione e di ordine da asporto · ultimo aggiornamento: {UPDATED}</p>

    <Art n="1" title="Oggetto">
      <C>Le presenti condizioni disciplinano l'utilizzo delle pagine di prenotazione e di ordine da asporto messe a disposizione da un locale che si avvale della piattaforma SmartEats{legal.name ? `, fornita da ${legal.name}` : ''}. Inviando una richiesta l'utente dichiara di averle lette e di accettarle.</C>
      <C>La piattaforma costituisce lo strumento tecnico mediante il quale il locale riceve e gestisce le richieste. Il fornitore della piattaforma non è parte del rapporto tra l'utente e il locale.</C>
    </Art>

    <Art n="2" title="Richiesta e conclusione del contratto">
      <C>La compilazione e l'invio del modulo costituiscono una proposta rivolta al locale e non determinano, di per sé, alcun obbligo di quest'ultimo né la riserva definitiva del tavolo o dei prodotti.</C>
      <C>Il contratto si intende concluso nel momento in cui l'utente ha conoscenza della conferma del locale (art. 1326 del codice civile), comunicata al recapito indicato. Il locale può rifiutare la richiesta anche per ragioni organizzative.</C>
      <C>La richiesta non confermata entro il termine previsto decade, e i posti o la fascia di ritiro tornano disponibili: l'utente può inviarne una nuova o contattare direttamente il locale.</C>
    </Art>

    <Art n="3" title="Ritiro e annullamento">
      <C>La richiesta non ancora confermata può essere ritirata in qualsiasi momento dal collegamento ricevuto dall'utente.</C>
      <C>La prenotazione confermata può essere annullata, mediante richiesta dalla medesima pagina, fino a un'ora prima dell'inizio del turno; successivamente l'utente è tenuto a contattare direttamente il locale. L'annullamento è soggetto all'accettazione del locale.</C>
    </Art>

    <Art n="4" title="Ordini da asporto e pagamento">
      <C>Salvo diversa indicazione sulla pagina, il corrispettivo dell'ordine da asporto è pagato al momento del ritiro.</C>
      <C>Qualora il locale abiliti il pagamento online con carta, l'importo è autorizzato al momento dell'invio della richiesta e addebitato solo all'accettazione dell'ordine da parte del locale; in caso di rifiuto, annullamento o decadenza della richiesta l'autorizzazione è rilasciata e nulla è addebitato. Il pagamento è gestito da Stripe Payments Europe Limited, secondo le condizioni di tale fornitore.</C>
      <C>Prezzi, descrizioni dei prodotti e informazioni sugli allergeni sono forniti dal locale, che ne è responsabile.</C>
    </Art>

    <Art n="5" title="Obblighi dell'utente">
      <C>L'utente si impegna a fornire dati veritieri e completi, a indicare un recapito telefonico raggiungibile e a presentarsi all'orario concordato. L'utilizzo delle pagine per finalità diverse da quelle previste, o in modo da comprometterne il funzionamento, è vietato.</C>
    </Art>

    <Art n="6" title="Recesso">
      <C>Ai sensi dell'art. 59 del Codice del consumo (D.Lgs. 206/2005), il diritto di recesso non si applica, tra l'altro, ai contratti di fornitura di beni che rischiano di deteriorarsi o scadere rapidamente né ai servizi di ristorazione per i quali è prevista una data o un periodo di esecuzione specifico. Resta ferma la facoltà di ritiro e di annullamento disciplinata all'art. 3.</C>
    </Art>

    <Art n="7" title="Responsabilità">
      <C>Il locale risponde della preparazione e della fornitura dei prodotti e dei servizi richiesti, nonché della correttezza delle informazioni pubblicate. Il fornitore della piattaforma risponde unicamente del funzionamento del servizio informatico e non garantisce l'assenza di interruzioni o di errori.</C>
      <C>Nei limiti consentiti dalla legge, e salvo il caso di dolo o colpa grave, il fornitore della piattaforma non risponde dei danni indiretti derivanti dall'utilizzo o dal mancato utilizzo del servizio. Restano fermi i diritti che la legge riconosce in via inderogabile al consumatore.</C>
    </Art>

    <Art n="8" title="Trattamento dei dati personali">
      <C>Il trattamento dei dati personali è descritto nell'<a className="text-[var(--accent)] font-medium" href="/privacy">informativa sulla privacy</a>, che costituisce parte integrante delle presenti condizioni.</C>
    </Art>

    <Art n="9" title="Legge applicabile e foro competente">
      <C>Le presenti condizioni sono regolate dalla legge italiana. Per le controversie con l'utente che riveste la qualità di consumatore è competente, in via esclusiva, il giudice del luogo di residenza o di domicilio del consumatore (art. 66-bis del Codice del consumo).</C>
    </Art>

    <Art n="10" title="Modifiche e contatti">
      <C>Le presenti condizioni possono essere modificate; la versione vigente è quella pubblicata su questa pagina e si applica alle richieste inviate dopo la data di ultimo aggiornamento.</C>
      <C>{legal.email ? <>Per informazioni sul servizio: <Mail legal={legal} />.</> : 'Per informazioni sul servizio è possibile rivolgersi direttamente al locale.'}</C>
    </Art>
  </>
);

const LegalPage = ({ kind }) => {
  const [legal, setLegal] = useState(null);
  useEffect(() => { apiFetch('/public/legal').then(setLegal).catch(() => setLegal({})); }, []);
  useEffect(() => { document.title = kind === 'terms' ? "Condizioni d'uso · SmartEats" : 'Privacy · SmartEats'; }, [kind]);
  return (
    <PublicShell>
      {legal === null ? <Loading /> : (kind === 'terms' ? <Terms legal={legal} /> : <Privacy legal={legal} />)}
      <div className="h-8" />
    </PublicShell>
  );
};

export default LegalPage;
