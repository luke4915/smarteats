import test from 'node:test';
import assert from 'node:assert/strict';
import { licenseStatus, countByKind, filterTenants, slugify, addressOf } from './licenseStatus.js';

const NOW = new Date('2026-10-18T12:00:00Z').getTime();
const day = (n) => new Date(NOW + n * 86400000).toISOString();

test('stato della licenza: disattivato, senza scadenza, scaduto, in scadenza, attivo', () => {
  assert.equal(licenseStatus({ active: false }, NOW).kind, 'off');
  assert.equal(licenseStatus({ active: true, expires_at: null }, NOW).kind, 'ok');
  assert.equal(licenseStatus({ active: true, expires_at: day(-1) }, NOW).kind, 'expired');
  assert.equal(licenseStatus({ active: true, expires_at: day(2) }, NOW).kind, 'soon');
  assert.equal(licenseStatus({ active: true, expires_at: day(40) }, NOW).kind, 'ok');
});

const tenants = [
  { name: 'Sagra del Calzone', slug: 'calzone', active: true, expires_at: day(40) },
  { name: 'Trattoria Rossi', slug: 'rossi', active: true, expires_at: day(1) },
  { name: 'Vecchio Forno', slug: 'forno', active: false },
];

test('conteggi e filtri', () => {
  assert.deepEqual(countByKind(tenants, NOW), { all: 3, ok: 1, soon: 1, off: 1 });
  assert.deepEqual(filterTenants(tenants, 'soon', '', NOW).map(t => t.slug), ['rossi']);
  assert.deepEqual(filterTenants(tenants, 'all', '  CALZ ', NOW).map(t => t.slug), ['calzone']);
});

test('indirizzo dal nome e dal dominio della console', () => {
  assert.equal(slugify('Sagra dell\'Unità — 2026!'), 'sagra-dell-unita-2026');
  assert.equal(addressOf('rossi', 'smarteats.local', { protocol: 'https:', port: '5173' }), 'https://rossi.smarteats.local:5173');
  assert.equal(addressOf('rossi', 'smarteats.duckdns.org', { protocol: 'https:', port: '' }), 'https://rossi.smarteats.duckdns.org');
});
