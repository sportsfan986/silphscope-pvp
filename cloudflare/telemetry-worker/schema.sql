-- SilphScope PvP — Cloudflare D1 Multi-Device Vault Sync & Userbase-Wide Meta Schema
-- Designed for strict primary/composite index usage (<0.1% of D1 Free Tier 5M reads/100k writes/day)

CREATE TABLE IF NOT EXISTS user_vault_state (
  screen_name TEXT PRIMARY KEY COLLATE NOCASE,
  display_screen_name TEXT NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}',
  settings_updated_at INTEGER NOT NULL DEFAULT 0,
  migrated_from_github INTEGER NOT NULL DEFAULT 0,
  migrated_at_ms INTEGER NOT NULL DEFAULT 0,
  server_updated_ms INTEGER NOT NULL DEFAULT 0,
  total_active_logs INTEGER NOT NULL DEFAULT 0,
  total_active_teams INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS battle_logs (
  screen_name TEXT NOT NULL COLLATE NOCASE,
  log_id TEXT NOT NULL,
  season_id TEXT NOT NULL DEFAULT '',
  league TEXT NOT NULL DEFAULT 'GREAT LEAGUE',
  combat_mode TEXT NOT NULL DEFAULT 'gbl',
  result TEXT NOT NULL DEFAULT 'WIN',
  lead_matchup TEXT NOT NULL DEFAULT 'NEUTRAL',
  user_lead TEXT NOT NULL DEFAULT '',
  user_back1 TEXT NOT NULL DEFAULT '',
  user_back2 TEXT NOT NULL DEFAULT '',
  opp_lead TEXT NOT NULL DEFAULT '',
  opp_back1 TEXT NOT NULL DEFAULT '',
  opp_back2 TEXT NOT NULL DEFAULT '',
  first_swap_actor TEXT NOT NULL DEFAULT '',
  switch_advantage TEXT NOT NULL DEFAULT '',
  bmf_score REAL,
  exec_wae REAL,
  timestamp_ms INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  server_updated_ms INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'app_sync',
  payload_json TEXT NOT NULL,
  PRIMARY KEY (screen_name, log_id)
);

CREATE INDEX IF NOT EXISTS idx_battle_logs_user_sync
  ON battle_logs (screen_name, server_updated_ms);

CREATE INDEX IF NOT EXISTS idx_battle_logs_user_ts
  ON battle_logs (screen_name, deleted, timestamp_ms DESC);

CREATE INDEX IF NOT EXISTS idx_battle_logs_meta_global
  ON battle_logs (deleted, league, season_id, timestamp_ms DESC);

CREATE INDEX IF NOT EXISTS idx_battle_logs_meta_ts
  ON battle_logs (deleted, timestamp_ms DESC);

CREATE TABLE IF NOT EXISTS team_presets (
  screen_name TEXT NOT NULL COLLATE NOCASE,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  league TEXT NOT NULL DEFAULT 'GREAT LEAGUE',
  combat_mode TEXT NOT NULL DEFAULT 'gbl',
  archetype TEXT NOT NULL DEFAULT 'ABC',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  server_updated_ms INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (screen_name, team_id)
);

CREATE INDEX IF NOT EXISTS idx_team_presets_user_sync
  ON team_presets (screen_name, server_updated_ms);
