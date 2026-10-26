// Le guardie delle route del magazzino: dopo `authenticate`. Il tenant arriva dal token, mai dal client.
import { getTenantModules } from '../tenantModules.js';
import logger from '../../logger.js';

// Il magazzino con ingredienti, ricette e fornitori esiste solo nella modalità «magazzino»; le porzioni non lo usano.
export const requireWarehouseMode = async (req, res, next) => {
  try {
    const inventory = (await getTenantModules(req.user.tenantId))?.inventory;
    if (inventory?.mode !== 'warehouse')
      return res.status(403).json({ error: 'Funzione non attiva per questo locale', code: 'MODULE_DISABLED' });
    next();
  } catch (err) {
    logger.error({ err }, 'Errore verifica modalità magazzino');
    res.status(500).json({ error: 'Errore interno' });
  }
};
