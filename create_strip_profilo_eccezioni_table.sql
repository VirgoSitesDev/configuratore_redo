-- Create table for strip-profile compatibility exceptions
-- This table stores exceptions to the normal larghezza (width) compatibility rule
-- When a strip is listed here with a profile family, they are considered compatible
-- even if the strip width exceeds the profile width

CREATE TABLE IF NOT EXISTS strip_profilo_eccezioni (
    id SERIAL PRIMARY KEY,
    strip_codice TEXT NOT NULL,
    profilo_famiglia TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(strip_codice, profilo_famiglia)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_strip_profilo_eccezioni_strip ON strip_profilo_eccezioni(strip_codice);
CREATE INDEX IF NOT EXISTS idx_strip_profilo_eccezioni_profilo ON strip_profilo_eccezioni(profilo_famiglia);

-- Add comment to table
COMMENT ON TABLE strip_profilo_eccezioni IS 'Stores compatibility exceptions between strips and profile families that override the standard larghezza rule';
COMMENT ON COLUMN strip_profilo_eccezioni.strip_codice IS 'The strip code (e.g., COB24V...)';
COMMENT ON COLUMN strip_profilo_eccezioni.profilo_famiglia IS 'The profile family code (e.g., PRF005, PRF174)';
