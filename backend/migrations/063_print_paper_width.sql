-- Larghezza della carta di ogni stampante (58 o 80 mm): da lei dipende quante lettere stanno in una riga dello scontrino.
-- 80 mm è il valore di prima, quindi le stampanti già configurate non cambiano.
ALTER TABLE print_settings ADD COLUMN IF NOT EXISTS paper_mm smallint NOT NULL DEFAULT 80;
ALTER TABLE print_settings DROP CONSTRAINT IF EXISTS print_settings_paper_mm_check;
ALTER TABLE print_settings ADD CONSTRAINT print_settings_paper_mm_check CHECK (paper_mm IN (58, 80));
