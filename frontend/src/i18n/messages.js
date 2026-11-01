// I testi dell'interfaccia in ogni lingua (uno per file in messages/). L'italiano è la lingua di riserva: una frase che manca altrove si legge in italiano.
// Una chiave nuova si scrive prima in italiano; `messages.test.js` controlla che le altre lingue abbiano le stesse chiavi e gli stessi segnaposto.
import it from './messages/it.js';
import en from './messages/en.js';
import de from './messages/de.js';
import fr from './messages/fr.js';
import es from './messages/es.js';

export const MESSAGES = { it, en, de, fr, es };
