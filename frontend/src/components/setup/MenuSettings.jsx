import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { useToast } from '../../context/useToast';
import { apiFetch, fetchWithAuth } from '../../utils/apiClient';
import { btnPrimary, input } from '../../smarteats/floor/ui';

const MenuSettings = () => {
    const { showToast } = useToast();
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // Stesso endpoint pubblico letto dal menu con QR.
        apiFetch('/settings')
            .then(data => setWelcomeMessage(data.welcome_message || ''))
            .catch(err => showToast(`Errore caricamento messaggio: ${err.message}`, 'error'))
            .finally(() => setLoading(false));
    }, [showToast]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetchWithAuth('/settings/welcome_message', { method: 'PUT', body: { value: welcomeMessage } });
            showToast('Messaggio salvato!', 'success');
        } catch (err) {
            showToast(`Errore salvataggio: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border)] space-y-3">
            <label htmlFor="welcome-message" className="block text-sm font-medium text-[var(--text-main)]">Messaggio di benvenuto</label>
            <textarea id="welcome-message"
                value={loading ? '' : welcomeMessage}
                onChange={e => setWelcomeMessage(e.target.value)}
                placeholder="Es. Benvenuto alla Sagra del Calzone 2026! Scegli i tuoi prodotti..."
                rows={3}
                className={`${input} !h-auto py-3 resize-none`}
            />
            <button onClick={handleSave} disabled={saving} className={btnPrimary}>
                <Save size={16} /> {saving ? 'Salvataggio...' : 'Salva'}
            </button>
        </div>
    );
};

export default MenuSettings;
