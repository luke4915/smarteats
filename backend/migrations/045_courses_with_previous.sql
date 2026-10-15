-- ============================================
-- Portate che escono insieme alla precedente
-- ============================================
-- Secondi e contorni (o antipasti e bevande) escono insieme: una portata può essere segnata «insieme alla precedente».
-- In comanda ha lo stesso numero d'uscita di quella prima (utils/courseOrders: `course_seq`); il cameriere può sempre
-- cambiarlo per quel tavolo.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS with_previous BOOLEAN NOT NULL DEFAULT false;
