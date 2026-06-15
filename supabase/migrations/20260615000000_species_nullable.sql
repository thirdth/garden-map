-- Allow genus-level plant entries (no species epithet)
ALTER TABLE plants ALTER COLUMN species DROP NOT NULL;
