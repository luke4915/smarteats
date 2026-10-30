import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import deviceRoutes from './routes/devices.js';
import sessionRoutes from './routes/sessions.js';
import statsRoutes from './routes/stats.js';
import { roomsRouter, tablesRouter } from './routes/rooms.js';
import coursesRouter from './routes/courses.js';
import ingredientsRouter from './routes/ingredients.js';
import preparationsRouter from './routes/preparations.js';
import suppliersRouter from './routes/suppliers.js';
import goodsReceiptsRouter from './routes/goodsReceipts.js';
import stockLevelsRouter from './routes/stockLevels.js';
import inventoryMovementsRouter from './routes/inventoryMovements.js';
import inventoryReportsRouter from './routes/inventoryReports.js';
import inventoryRestockRouter from './routes/inventoryRestock.js';
import reservedDataRouter from './routes/reservedData.js';
import stripeWebhookRoutes from './routes/stripeWebhook.js';
import { productRecipeRouter, modifierRecipeRouter } from './routes/recipes.js';
import { inventoryRouter, productAvailabilityRouter } from './routes/inventoryAvailability.js';
import bookingRoutes from './routes/bookings.js';
import publicBookingRoutes from './routes/publicBooking.js';
import takeawayRoutes from './routes/takeaway.js';
import feedbackRoutes from './routes/feedback.js';
import whatsappRoutes from './routes/whatsapp.js';
import whatsappWebhookRoutes from './routes/whatsappWebhook.js';
import legalRoutes from './routes/legal.js';
import publicTakeawayRoutes from './routes/publicTakeaway.js';
import { modifierGroupsRouter, productModifiersRouter } from './routes/modifierGroups.js';
import checkRoutes from './routes/checks.js';
import healthRoutes from './routes/health.js';
import { requestLogger } from './middleware/requestLogger.js';
import exportRoutes from './routes/exports.js';
import printSettingsRoutes from './routes/printSettings.js';
import settingsRoutes from './routes/settings.js';
import masterRoutes from './routes/master.js';
import { loginLimiter, apiLimiter, ordersLimiter, devicesLimiter, exportsLimiter, reservedUnlockLimiter, publicBookingReadLimiter, publicBookingWriteLimiter } from './middleware/rateLimiter.js';
import { isAllowedOrigin } from './utils/origins.js';
import logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Applicazione Express senza server né porta: la avvia server.js (HTTPS) e la usano
// i test di integrazione. `broadcast` arriva dal WebSocket (ws.js); `rateLimit: false`
// serve solo ai test, che inviano molte richieste di fila dallo stesso indirizzo.
export function createApp({ broadcast, rateLimit = true, logRequests = true }) {
  const app = express();

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // il frontend chiama le API e il WebSocket su HTTPS/WSS
        'connect-src': ["'self'", 'https://*', 'wss://*'],
      },
    },
  }));

  app.set('trust proxy', 1); // necessario per il rate limiter dietro proxy/nginx

  app.use(cookieParser());
  // Richieste dal browser da un'origine non ammessa: 403 prima di eseguire qualsiasi cosa.
  // Senza Origin (app native, script, stesso sito in GET) si prosegue normalmente.
  app.use((req, res, next) => {
    const { origin } = req.headers;
    if (origin && !isAllowedOrigin(origin)) return res.status(403).json({ error: 'Origine non consentita' });
    next();
  });
  app.use(cors({ origin: true, credentials: true }));
  app.use('/api/health', healthRoutes); // prima di limiti e log: lo interroga il monitoraggio ogni pochi secondi
  if (logRequests) app.use('/api', requestLogger);
  // Il webhook di Meta è firmato sul corpo grezzo: lo si conserva solo per quel percorso
  app.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { if (req.originalUrl.startsWith('/api/webhooks/')) req.rawBody = buf; } }));
  // Dalla cartella assets si servono solo i suoni: lì stanno anche loghi che non devono essere pubblici.
  app.use('/api/assets', (req, res, next) => (req.path.endsWith('.mp3') ? next() : res.status(404).json({ error: 'Non trovato' })),
    express.static(path.join(__dirname, 'assets'), { index: false, dotfiles: 'deny' }));

  if (rateLimit) {
    app.use('/api', apiLimiter);
    app.use('/api/auth/login', loginLimiter);
    app.use('/api/master/login', loginLimiter);
    app.use('/api/orders', ordersLimiter);
    app.use('/api/devices', devicesLimiter);
    app.use('/api/exports', exportsLimiter);
    app.use(['/api/reserved-data/unlock', '/api/reserved-data/disable'], reservedUnlockLimiter);
    app.use('/api/public/booking', (req, res, next) => (req.method === 'POST' ? publicBookingWriteLimiter : publicBookingReadLimiter)(req, res, next));
    app.use('/api/public/takeaway', (req, res, next) => (req.method === 'POST' ? publicBookingWriteLimiter : publicBookingReadLimiter)(req, res, next));
  }

  app.use('/api/auth', authRoutes);
  app.use('/api/reserved-data', reservedDataRouter);
  app.use('/api/profile', profileRoutes);
  app.use('/api/products', productModifiersRouter); // PUT /:id/modifier-groups, prima delle route dei prodotti
  app.use('/api/products', productRecipeRouter);          // GET/PUT /:id/recipe (magazzino)
  app.use('/api/products', productAvailabilityRouter(broadcast));    // PUT /:id/availability (esaurito)
  app.use('/api/products', productRoutes(broadcast));
  app.use('/api/modifier-groups', modifierGroupsRouter);
  app.use('/api/modifiers', modifierRecipeRouter);        // GET/PUT /:id/recipe (magazzino)
  app.use('/api/ingredients', ingredientsRouter);
  app.use('/api/preparations', preparationsRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.use('/api/goods-receipts', goodsReceiptsRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/inventory', inventoryMovementsRouter);       // /movements, /usage
  app.use('/api/inventory/report', inventoryReportsRouter);
  app.use('/api/inventory/restock', inventoryRestockRouter);
  app.use('/api/stock-levels', stockLevelsRouter);
  app.use('/api/print-settings', printSettingsRoutes);
  app.use('/api/orders', orderRoutes(broadcast));
  app.use('/api/devices', deviceRoutes);
  app.use('/api/sessions', sessionRoutes(broadcast));
  app.use('/api/exports', exportRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/rooms', roomsRouter);
  app.use('/api/tables', tablesRouter);
  app.use('/api/courses', coursesRouter);
  app.use('/api/bookings', bookingRoutes(broadcast));
  app.use('/api/public/booking', publicBookingRoutes(broadcast));
  app.use('/api/takeaway', takeawayRoutes(broadcast));
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/whatsapp', whatsappRoutes);
  app.use('/api/webhooks/whatsapp', whatsappWebhookRoutes);
  app.use('/api/webhooks/stripe', stripeWebhookRoutes(broadcast));
  app.use('/api/public/legal', legalRoutes);
  app.use('/api/public/takeaway', publicTakeawayRoutes(broadcast));
  app.use('/api/checks', checkRoutes(broadcast));
  app.use('/api/settings', settingsRoutes);
  app.use('/api/master', masterRoutes);

  // In produzione il backend serve anche il frontend compilato
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, '..', 'frontend', 'dist');
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(distPath, 'index.html'));
      }
      next();
    });
  }

  app.use((err, _req, res, _next) => {
    // JSON malformato o troppo grande: errore di chi chiama, non del server
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Corpo della richiesta non valido' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Richiesta troppo grande' });
    logger.error({ err }, 'Errore non gestito');
    res.status(500).json({ error: 'Errore interno del server' });
  });

  return app;
}
