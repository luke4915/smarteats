import { inventoryOf } from './modules.js';
import { licenseInfo } from './license.js';

// Ciò che l'app riceve quando una sessione comincia (login e cambio utente con il PIN): chi è, il locale, i moduli e la licenza.
// `tenant`: la riga di `tenants` (name, business_type, modules, inventory_mode, inventory_depletion, expires_at).
export function sessionPayload(user, tenant) {
  return {
    id: user.id, username: user.username, role: user.role, needsPassword: user.must_change_password, hasPin: !!user.pin_hash, pinLength: user.pin_length ?? null, pinSetAt: user.pin_set_at ?? null,
    tenantName: tenant.name, businessType: tenant.business_type, modules: tenant.modules, inventory: inventoryOf(tenant), license: licenseInfo(tenant.expires_at),
  };
}
