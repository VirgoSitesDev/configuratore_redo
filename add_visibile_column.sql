-- Migration: Add 'visibile' column to all relevant tables
-- Date: 2025-10-07
-- Description: Adds a boolean 'visibile' column to profili_test, strip_test, alimentatori_test, dimmer, tappi, staffe, and diffusori tables

-- Add visibile column to profili_test
ALTER TABLE profili_test
ADD COLUMN IF NOT EXISTS visibile BOOLEAN DEFAULT TRUE;

-- Add visibile column to strip_test
ALTER TABLE strip_test
ADD COLUMN IF NOT EXISTS visibile BOOLEAN DEFAULT TRUE;

-- Add visibile column to alimentatori_test
ALTER TABLE alimentatori_test
ADD COLUMN IF NOT EXISTS visibile BOOLEAN DEFAULT TRUE;

-- Add visibile column to dimmer
ALTER TABLE dimmer
ADD COLUMN IF NOT EXISTS visibile BOOLEAN DEFAULT TRUE;

-- Add visibile column to tappi
ALTER TABLE tappi
ADD COLUMN IF NOT EXISTS visibile BOOLEAN DEFAULT TRUE;

-- Add visibile column to staffe
ALTER TABLE staffe
ADD COLUMN IF NOT EXISTS visibile BOOLEAN DEFAULT TRUE;

-- Add visibile column to diffusori
ALTER TABLE diffusori
ADD COLUMN IF NOT EXISTS visibile BOOLEAN DEFAULT TRUE;

-- Update all existing rows to have visibile = TRUE
UPDATE profili_test SET visibile = TRUE WHERE visibile IS NULL;
UPDATE strip_test SET visibile = TRUE WHERE visibile IS NULL;
UPDATE alimentatori_test SET visibile = TRUE WHERE visibile IS NULL;
UPDATE dimmer SET visibile = TRUE WHERE visibile IS NULL;
UPDATE tappi SET visibile = TRUE WHERE visibile IS NULL;
UPDATE staffe SET visibile = TRUE WHERE visibile IS NULL;
UPDATE diffusori SET visibile = TRUE WHERE visibile IS NULL;
