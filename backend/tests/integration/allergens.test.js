// Allergeni e traduzioni del nome dei prodotti: li dichiara solo l'amministratore, gli allergeni sono quelli dell'allegato II e tutto arriva ai clienti nei menu pubblici.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, createTenant, deleteTenants, closePools, apiClient } from './helpers.js';

describe('allergeni dei prodotti', () => {
  let server, t, admin, anon;
  const base = { name: 'Lasagna', price: 9, category: 'Primi', color: '#ff8800', visible: true, print_destination: 'kitchen' };

  before(async () => {
    server = await startServer();
    t = await createTenant();
    admin = apiClient(server.port, t.host); anon = apiClient(server.port, t.host);
    await admin.login(t.username);
  });
  after(async () => { await deleteTenants(t); await server.close(); await closePools(); });

  it('si dichiarano alla creazione e si cambiano dopo; assenti nel modulo = non si cambiano', async () => {
    const created = await admin.request('POST', '/products', { ...base, allergens: ['milk', 'gluten', 'milk'] });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.deepEqual(created.body.allergens, ['gluten', 'milk'], 'senza doppioni e nell\'ordine dell\'allegato');
    const id = created.body.id;
    assert.deepEqual((await admin.request('PUT', `/products/${id}`, { ...base, name: 'Lasagne' })).body.allergens, ['gluten', 'milk'], 'il modulo senza allergeni non li cancella');
    assert.deepEqual((await admin.request('PUT', `/products/${id}`, { ...base, allergens: ['eggs'] })).body.allergens, ['eggs']);
    assert.deepEqual((await admin.request('PUT', `/products/${id}`, { ...base, allergens: [] })).body.allergens, [], 'elenco vuoto = nessuno dichiarato');
    assert.deepEqual((await admin.get('/products')).body.find(p => p.id === t.productId).allergens, [], 'i prodotti di prima partono senza');
  });

  it('un allergene che non esiste è un errore', async () => {
    const bad = await admin.request('POST', '/products', { ...base, name: 'Strano', allergens: ['pollo'] });
    assert.equal(bad.status, 400);
  });

  it('i clienti li vedono nel menu pubblico, solo per i prodotti visibili', async () => {
    const id = (await admin.request('POST', '/products', { ...base, name: 'Gelato', allergens: ['milk', 'tree_nuts'] })).body.id;
    const menu = await anon.get('/products/menu');
    assert.equal(menu.status, 200, JSON.stringify(menu.body));
    assert.deepEqual(menu.body.products.find(p => p.id === id).allergens, ['milk', 'tree_nuts']);
  });

  it('il nome nelle altre lingue: si salva ripulito, assente = non si cambia, arriva ai clienti', async () => {
    const created = await admin.request('POST', '/products', { ...base, name: 'Tiramisù', translations: { en: ' Tiramisu ', de: '', ja: 'x' } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.deepEqual(created.body.translations, { en: 'Tiramisu' });
    const id = created.body.id;
    assert.deepEqual((await admin.request('PUT', `/products/${id}`, { ...base, name: 'Tiramisù' })).body.translations, { en: 'Tiramisu' }, 'il modulo senza traduzioni non le cancella');
    assert.deepEqual((await admin.request('PUT', `/products/${id}`, { ...base, name: 'Tiramisù', translations: { fr: 'Tiramisu', es: 'Tiramisú' } })).body.translations, { fr: 'Tiramisu', es: 'Tiramisú' });
    assert.deepEqual((await anon.get('/products/menu')).body.products.find(p => p.id === id).translations, { fr: 'Tiramisu', es: 'Tiramisú' });
    assert.deepEqual((await admin.request('PUT', `/products/${id}`, { ...base, name: 'Tiramisù', translations: {} })).body.translations, {});
  });
});
