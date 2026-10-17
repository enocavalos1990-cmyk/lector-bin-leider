-- Sesiones de acceso con usuario recepcion; la contraseña queda en un secreto de Cloudflare.
CREATE TABLE IF NOT EXISTS login_sessions (
 id TEXT PRIMARY KEY NOT NULL,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_login_sessions_expiry ON login_sessions(expires_at);
