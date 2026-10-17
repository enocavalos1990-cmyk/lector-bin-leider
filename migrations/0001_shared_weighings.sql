-- D1 migration 0001: shared weighings. Schema only; API/auth not yet implemented.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS authorized_devices (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_devices_workspace ON authorized_devices(workspace_id);

CREATE TABLE IF NOT EXISTS weighings (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  display_number INTEGER NOT NULL CHECK(display_number > 0),
  local_day TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','finalized')),
  started_at TEXT NOT NULL,
  finalized_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK ((status = 'active' AND finalized_at IS NULL) OR (status = 'finalized' AND finalized_at IS NOT NULL)),
  UNIQUE(workspace_id, local_day, display_number)
);
CREATE INDEX IF NOT EXISTS idx_weighings_workspace_day ON weighings(workspace_id, local_day, display_number);

CREATE TABLE IF NOT EXISTS weighing_rows (
  id TEXT PRIMARY KEY NOT NULL,
  weighing_id TEXT NOT NULL REFERENCES weighings(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK(position > 0),
  bin_code TEXT,
  folio TEXT,
  manual INTEGER NOT NULL DEFAULT 0 CHECK(manual IN (0,1)),
  gross_kg INTEGER CHECK(gross_kg IS NULL OR gross_kg >= 0),
  tare_kg INTEGER NOT NULL DEFAULT 41 CHECK(tare_kg IN (41,44)),
  net_kg INTEGER GENERATED ALWAYS AS (CASE WHEN gross_kg IS NULL THEN NULL ELSE gross_kg - tare_kg END) VIRTUAL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(weighing_id, position),
  CHECK(bin_code IS NULL OR bin_code = 'NN' OR (length(bin_code) = 4 AND bin_code NOT GLOB '*[^0-9]*'))
);
-- NN is an intentional repeatable placeholder; other codes may occur once per weighing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rows_unique_bin ON weighing_rows(weighing_id,bin_code)
WHERE bin_code IS NOT NULL AND bin_code <> 'NN';
CREATE INDEX IF NOT EXISTS idx_rows_weighing_position ON weighing_rows(weighing_id, position);
