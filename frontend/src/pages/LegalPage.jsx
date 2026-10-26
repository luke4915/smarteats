import { useEffect, useState } from 'react';
import { apiFetch } from '../utils/apiClient';
import { PublicShell } from '../components/public/PublicShell';
import { useSystemTheme } from '../hooks/useSystemTheme';
import Loading from '../components/shared/Loading';

// Informativa privacy e condizioni d'uso (`/privacy`, `/terms`): pagine pubbliche, uguali per tutti i locali. Chi fornisce
// il servizio (nome, email) arriva dal server (`LEGAL_*`). Il titolare del trattamento è il locale; il fornitore agisce
// per suo conto. Testi da far rivedere a un professionista prima del lancio (docs/guida-whatsapp-meta.md).
const H = ({ children }) => <h2 className="text-base font-semibold mt-6 mb-1.5">{children}</h2>;
const P = ({ children }) => <p className="text-sm leading-relaxed text-[var(--text-muted)]">{children}</p>;
const Li = ({ children }) => <li className="text-sm leading-relaxed text-[var(--text-muted)]">{children}</li>;

const Privacy = ({ legal }) => {
  const who = legal.name || 'il fornitore del servizio SmartEats';
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Informativa sulla privacy</h1>
      <P>Questa pagina spiega come vengono usati i tuoi dati quando prenoti un tavolo o ordini da asporto da un locale che usa SmartEats.</P>

      <H>Chi tratta i tuoi dati</H>
      <P>Il <b className="text-[var(--text-main)]">titolare del trattamento è il locale</b> a cui invii la richiesta: decide perché e come usare i dati. {who} fornisce il software e tratta i dati per conto del locale (responsabile del trattamento).</P>

      <H>Quali dati</H>
      <ul className="list-disc pl-5 space-y-1">
        <Li>nome e numero di telefono, che sono necessari; email e note, facoltative;</Li>
        <Li>i dettagli della richiesta: giorno, orario, persone, e per l'asporto i prodotti e il totale;</Li>
        <Li>dati tecnici (indirizzo IP, data e ora) usati solo per la sicurezza e per evitare abusi.</Li>
      </ul>

      <H>Perché e su quale base</H>
      <ul className="list-disc pl-5 space-y-1">
        <Li><b className="text-[var(--text-main)]">Gestire la tua richiesta</b> e avvisarti sul suo stato (ricevuta, confermata, pronta, annullata): serve a eseguire quanto hai chiesto.</Li>
        <Li><b className="text-[var(--text-main)]">Avvisi su WhatsApp</b> sulla stessa richiesta, al numero che hai indicato.</Li>
        <Li><b className="text-[var(--text-main)]">Messaggi di ringraziamento e novità</b> del locale: solo se spunti la casella facoltativa, e puoi ritirare il consenso in ogni momento.</Li>
      </ul>

      <H>WhatsApp</H>
      <P>Gli avvisi sono inviati con la piattaforma WhatsApp Business di Meta Platforms Ireland Ltd., da un numero dedicato. Meta tratta il tuo numero e il messaggio per consegnarlo. Se non vuoi più riceverli, rispondi <b className="text-[var(--text-main)]">STOP</b> a un avviso: non ne riceverai altri da questo numero.</P>

      <H>Per quanto tempo</H>
      <P>Nome, telefono, email e note si cancellano <b className="text-[var(--text-main)]">90 giorni</b> dopo la data della prenotazione o del ritiro. Restano solo numeri anonimi (quante persone, quanti ordini) per le statistiche del locale.</P>

      <H>Chi può vedere i dati</H>
      <P>Il personale del locale, il fornitore tecnico del software e dell'hosting, e Meta per il solo invio dei messaggi WhatsApp. Non vendiamo i dati e non li usiamo per pubblicità.</P>

      <H>I tuoi diritti</H>
      <P>Puoi chiedere di accedere ai tuoi dati, correggerli, cancellarli o opporti al loro uso, e ritirare il consenso. Rivolgiti al locale oppure scrivi a {legal.email ? <a className="text-[var(--accent)] font-medium" href={`mailto:${legal.email}`}>{legal.email}</a> : 'al locale'}. Hai anche il diritto di presentare reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).</P>

      <H>Cookie</H>
      <P>Non usiamo cookie di profilazione né strumenti di tracciamento. Il sito conserva solo ciò che serve a farlo funzionare.</P>
    </>
  );
};

const Terms = ({ legal }) => (
  <>
    <h1 className="text-2xl font-semibold tracking-tight">Condizioni d'uso</h1>
    <P>Valgono quando usi le pagine di prenotazione e di ordine da asporto di un locale che usa SmartEats{legal.name ? `, servizio fornito da ${legal.name}` : ''}.</P>

    <H>Come funziona</H>
    <ul className="list-disc pl-5 space-y-1">
      <Li>Quello che invii è una <b className="text-[var(--text-main)]">richiesta</b>: diventa una prenotazione o un ordine solo quando il locale la conferma. Ti avvisa sul numero che indichi.</Li>
      <Li>Se il locale non risponde in tempo la richiesta scade e i posti o la fascia tornano disponibili: puoi inviarne una nuova o chiamare.</Li>
      <Li>Una richiesta non ancora confermata si ritira dal tuo link. Una prenotazione confermata si può annullare chiedendolo dalla stessa pagina fino a un'ora prima del turno; dopo, chiama il locale.</Li>
      <Li>Gli ordini da asporto si pagano al ritiro.</Li>
    </ul>

    <H>I tuoi impegni</H>
    <P>Indica dati veritieri e un numero di cellulare raggiungibile, e presentati all'orario concordato. Il locale può rifiutare o annullare richieste anche per motivi organizzativi.</P>

    <H>Responsabilità</H>
    <P>Il servizio è fornito così com'è. SmartEats è il mezzo con cui il locale riceve le richieste: il rapporto per il pasto o l'ordine è tra te e il locale, che ne risponde. Non garantiamo l'assenza di interruzioni.</P>

    <H>Dati personali</H>
    <P>Come trattiamo i tuoi dati è spiegato nell'<a className="text-[var(--accent)] font-medium" href="/privacy">informativa sulla privacy</a>.</P>

    <H>Contatti</H>
    <P>{legal.email ? <>Per domande sul servizio: <a className="text-[var(--accent)] font-medium" href={`mailto:${legal.email}`}>{legal.email}</a>.</> : 'Per qualsiasi domanda rivolgiti direttamente al locale.'}</P>
  </>
);

const LegalPage = ({ kind }) => {
  useSystemTheme();
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
