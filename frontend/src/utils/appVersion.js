// La versione dell'app in esecuzione: la scrive la build (vite.config.js) leggendo `version` da package.json,
// che deve coincidere con l'etichetta del rilascio (vX.Y.Z). In sviluppo vale «dev».
/* global __APP_VERSION__ */
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
