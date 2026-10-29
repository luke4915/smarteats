import { useState } from 'react';
import Modal from '../shared/Modal';
import Segmented from '../../smarteats/floor/Segmented';
import TenantGeneral from './TenantGeneral';
import TenantModules from './TenantModules';
import TenantUsers from './TenantUsers';
import TenantWhatsApp from './TenantWhatsApp';
import TenantMenu from './TenantMenu';
import TenantPayments from './TenantPayments';

// La finestra di un locale: tutto ciò che il master può fare, in schede (Generale, Moduli, Utenti e, se il modulo è acceso,
// Menu pubblico e WhatsApp). L'elenco resta pulito: una riga per locale e un solo pulsante «Gestisci».
//   on  { extend(days), toggle, receipt, remove }: azioni sul locale (le esegue la pagina, che poi ricarica l'elenco)
const TenantManage = ({ tenant, catalog, on, onSaved, onClose }) => {
  const [tab, setTab] = useState('general');
  const tabs = [
    { id: 'general', label: 'Generale' },
    { id: 'modules', label: 'Moduli' },
    { id: 'users', label: 'Utenti' },
    ...(tenant.modules?.includes('payments') ? [{ id: 'payments', label: 'Pagamenti' }] : []),
    ...(tenant.modules?.includes('qr_menu') ? [{ id: 'menu', label: 'Menu pubblico' }] : []),
    ...(tenant.modules?.includes('whatsapp') ? [{ id: 'whatsapp', label: 'WhatsApp' }] : []),
  ];
  const current = tabs.some(t => t.id === tab) ? tab : 'general';   // se WhatsApp si spegne dalla scheda Moduli, si torna alla prima

  return (
    <Modal title={tenant.name} size="max-w-3xl" onClose={onClose}>
      <div className="space-y-5">
        <Segmented scroll label="Sezioni del locale" className="w-fit max-w-full" options={tabs} value={current} onChange={setTab} />
        {current === 'general' && <TenantGeneral tenant={tenant} catalog={catalog} on={on} />}
        {current === 'modules' && <TenantModules tenant={tenant} catalog={catalog} onSaved={onSaved} />}
        {current === 'users' && <TenantUsers tenant={tenant} onChanged={onSaved} />}
        {current === 'payments' && <TenantPayments tenant={tenant} />}
        {current === 'menu' && <TenantMenu tenant={tenant} />}
        {current === 'whatsapp' && <TenantWhatsApp tenant={tenant} />}
      </div>
    </Modal>
  );
};

export default TenantManage;
