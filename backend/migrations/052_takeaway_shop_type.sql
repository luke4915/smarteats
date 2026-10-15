-- Nuovo tipo di locale: attività che fa solo asporto (pizzeria da taglio, forno, rosticceria). Usa l'app SmartEats con
-- il solo modulo asporto, cucina, carta e statistiche: niente sala, tavoli né prenotazioni.
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_business_type_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_business_type_check
  CHECK (business_type IN ('street_food', 'restaurant', 'takeaway_shop'));
