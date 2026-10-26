import { useEffect, useState } from 'react';
import Segmented from '../smarteats/floor/Segmented';
import PeriodNav from '../smarteats/reservations/PeriodNav';
import { addDays, formatDay, todayLocal } from '../smarteats/reservations/rules';
import { addMonths, formatMonth, monthOf } from '../smarteats/reservations/calendar';
import { Overview, Dishes, Waste, Variance } from './ReportSections';
import { Spending, PriceChanges } from './ReportPurchases';
import { fetchWithAuth } from '../utils/apiClient';
import { useToast } from '../context/useToast';
import { reportRange } from './controls';

// Le statistiche del magazzino (scheda «Magazzino» di Statistiche), in tre parti: Margini (quanto costa ciò che si vende e quanto
// resta), Scarti e differenze (cosa si butta, se la dispensa torna) e Acquisti (quanto si spende e quali prezzi sono cambiati).
// Il periodo è un giorno o un mese; i conti li fa il server (backend/utils/inventory/reportsDb.js).
const PARTS = [{ id: 'margins', label: 'Margini' }, { id: 'waste', label: 'Scarti e differenze' }, { id: 'purchases', label: 'Acquisti' }];

const ReportPanel = ({ dish }) => {
  const { showToast } = useToast();
  const [part, setPart] = useState('margins');
  const [view, setView] = useState('day');
  const [date, setDate] = useState(todayLocal());
  const [month, setMonth] = useState(monthOf(todayLocal()));
  const [report, setReport] = useState(null);
  const { from, to } = reportRange(view, date, month);

  useEffect(() => {
    let current = true;
    setReport(null);
    fetchWithAuth(`/inventory/report?from=${from}&to=${to}`).then(r => { if (current) setReport(r); }).catch(err => showToast(err.message, 'error'));
    return () => { current = false; };
  }, [from, to, showToast]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {view === 'month'
          ? <PeriodNav label={formatMonth(month)} prevLabel="Mese precedente" nextLabel="Mese successivo" onPrev={() => setMonth(m => addMonths(m, -1))} onNext={() => setMonth(m => addMonths(m, 1))}
              isCurrent={month === monthOf(todayLocal())} onToday={() => setMonth(monthOf(todayLocal()))} todayLabel="Mese corrente" pickerType="month" pickerValue={month} onPick={setMonth} />
          : <PeriodNav label={formatDay(date)} prevLabel="Giorno precedente" nextLabel="Giorno successivo" onPrev={() => setDate(d => addDays(d, -1))} onNext={() => setDate(d => addDays(d, 1))}
              isCurrent={date === todayLocal()} onToday={() => setDate(todayLocal())} pickerValue={date} onPick={setDate} />}
        <Segmented label="Periodo" className="w-48" value={view} onChange={(v) => { if (v === 'month') setMonth(monthOf(date)); setView(v); }} options={[{ id: 'day', label: 'Giorno' }, { id: 'month', label: 'Mese' }]} />
      </div>
      <Segmented scroll label="Parte delle statistiche del magazzino" className="w-fit max-w-full" value={part} onChange={setPart} options={PARTS} />
      {!report ? <p className="text-sm text-[var(--text-muted)]">Caricamento…</p> : (
        <div className="space-y-6">
          {part === 'margins' && (
            <>
              <Overview totals={report.totals} inventoryValueCents={report.inventory_value_cents} />
              <Dishes dishes={report.dishes} dish={dish} />
              <p className="text-xs text-[var(--text-muted)]">Ricavi senza IVA: per i {dish === 'piatto' ? 'piatti' : 'prodotti'} senza aliquota si usa quella predefinita ({report.default_vat_rate}%), che si cambia dalle Impostazioni.</p>
            </>)}
          {part === 'waste' && (
            <>
              <Waste waste={report.waste} />
              <Variance variance={report.variance} totalCents={report.variance_value_cents} />
            </>)}
          {part === 'purchases' && (
            <>
              <Spending spending={report.spending} />
              <PriceChanges changes={report.price_changes} />
            </>)}
        </div>)}
    </section>
  );
};

export default ReportPanel;
