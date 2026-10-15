import express from 'express';

// Dati del fornitore del servizio per le pagine pubbliche /privacy e /terms: da variabili d'ambiente, senza login.
// Non c'è nulla di segreto; se non sono impostate le pagine dicono di contattare direttamente il locale.
const router = express.Router();

router.get('/', (_req, res) => {
  const { LEGAL_NAME: name = '', LEGAL_EMAIL: email = '', LEGAL_ADDRESS: address = '', LEGAL_VAT: vat = '' } = process.env;
  res.json({ name, email, address, vat, product: 'SmartEats' });
});

export default router;
