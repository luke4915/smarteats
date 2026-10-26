import { useState } from 'react';
import { PackageX } from 'lucide-react';
import SoldOutPanel from './SoldOutPanel';
import { useAuth } from '../context/useAuth';

const SoldOutButton = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user.inventory) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Segna esaurito" className="h-12 px-4 rounded-lg border border-[var(--border)] flex items-center gap-2 text-[var(--text-main)] text-lg font-medium"><PackageX size={22} /> <span className="hidden sm:inline">Esaurito</span></button>
      {open && <SoldOutPanel canSeeIngredients={user.inventory.mode === 'warehouse'} onClose={() => setOpen(false)} />}
    </>
  );
};

export default SoldOutButton;
