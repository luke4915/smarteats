import { useRef } from 'react';
import { Camera, Paperclip, X } from 'lucide-react';
import { btn } from '../smarteats/floor/ui';
import { prepareDocument } from './imageUpload';
import { useToast } from '../context/useToast';

// Foto o file della bolla. Su iPhone e iPad il selettore offre fotocamera e «Scansiona documenti»; su computer si sceglie un
// file. `files` sono già pronti per l'invio: [{ blob, name }]; il genitore li invia dopo aver salvato lo scarico.
const DocumentPicker = ({ files, onChange }) => {
  const { showToast } = useToast();
  const camera = useRef(null);
  const picker = useRef(null);

  const add = async (event) => {
    const chosen = [...event.target.files];
    event.target.value = '';
    const ready = [];
    for (const file of chosen) {
      try { ready.push(await prepareDocument(file)); } catch (err) { showToast(`${file.name}: ${err.message}`, 'error'); }
    }
    if (ready.length) onChange([...files, ...ready]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={() => camera.current.click()}><Camera size={16} /> Scatta foto o scansiona</button>
        <button type="button" className={btn} onClick={() => picker.current.click()}><Paperclip size={16} /> Allega un file</button>
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={add} aria-label="Scatta una foto della bolla" />
        <input ref={picker} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={add} aria-label="Allega la bolla" />
      </div>
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm text-[var(--text-main)]">
              <Paperclip size={14} className="text-[var(--text-muted)] shrink-0" /><span className="truncate flex-1">{f.name}</span>
              <span className="text-xs text-[var(--text-muted)] tabular-nums">{Math.max(1, Math.round(f.blob.size / 1024))} KB</span>
              <button type="button" className="p-1 rounded hover:bg-[var(--bg-card-2)] cursor-pointer" aria-label={`Togli ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))}><X size={14} /></button>
            </li>))}
        </ul>)}
    </div>
  );
};

export default DocumentPicker;
