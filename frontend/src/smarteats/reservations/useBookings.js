import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';

// I dati della giornata: turni, prenotazioni, disponibilità e sale (per assegnare i tavoli). Si rileggono quando un
// altro dispositivo cambia una prenotazione o un conto.
export function useBookings(date, event) {
  const { showToast } = useToast();
  const [shifts, setShifts] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [checks, setChecks] = useState([]);   // conti aperti: servono alla Timeline e ai walk-in
  const [day, setDay] = useState({ date: null, reservations: [], availability: [] });
  const latest = useRef(0);   // numero dell'ultima richiesta: una risposta più vecchia non deve sovrascrivere quella nuova

  useEffect(() => {
    Promise.all([fetchWithAuth('/bookings/shifts'), fetchWithAuth('/rooms')])
      .then(([s, r]) => { setShifts(s); setRooms(r); })
      .catch(err => showToast(err.message || 'Errore caricamento prenotazioni', 'error'));
  }, [showToast]);

  const reload = useCallback(async () => {
    const mine = ++latest.current;
    try {
      const [reservations, availability, openChecks] = await Promise.all([
        fetchWithAuth(`/bookings/reservations?date=${date}`), fetchWithAuth(`/bookings/availability?date=${date}`), fetchWithAuth('/checks')]);
      if (mine === latest.current) { setDay({ date, reservations, availability }); setChecks(openChecks); }
    } catch (err) { showToast(err.message || 'Errore caricamento prenotazioni', 'error'); }
  }, [date, showToast]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { if (event && ['reservation_updated', 'check_updated'].includes(event.type)) reload(); }, [event, reload]);

  // Finché non arrivano i dati del giorno scelto si mostra il caricamento (evita di vedere il giorno precedente)
  return { shifts, rooms, checks, reservations: day.reservations, availability: day.availability, loading: day.date !== date, reload };
}
