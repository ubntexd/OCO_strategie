-- db/schema.sql — BotTrader v1.0 (CD §8.1, CDC v1.1 §13)
-- Script idempotent

CREATE TABLE IF NOT EXISTS trades (
  id                  SERIAL PRIMARY KEY,
  symbol              VARCHAR(20) NOT NULL,
  entry_time          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exit_time           TIMESTAMPTZ,
  entry_price         NUMERIC(18, 8) NOT NULL,
  exit_price          NUMERIC(18, 8),
  qty                 NUMERIC(18, 8) NOT NULL,
  duration_min        INTEGER,
  pnl_brut            NUMERIC(18, 8),
  fees                NUMERIC(18, 8),
  pnl_net             NUMERIC(18, 8),
  result              VARCHAR(20) NOT NULL DEFAULT 'OPEN'
    CHECK (result IN ('TP', 'SL', 'OPEN', 'CANCELLED', 'FORCED_EXIT', 'SLIPPAGE_ABORT', 'DRY_RUN')),
  order_type          VARCHAR(10) NOT NULL DEFAULT 'OPOCO'
    CHECK (order_type IN ('OPOCO', 'OCO')),
  entry_mode          VARCHAR(15) NOT NULL DEFAULT 'LIMIT_MAKER'
    CHECK (entry_mode IN ('LIMIT_MAKER', 'MARKET')),
  regime              VARCHAR(20),
  kelly_fraction      NUMERIC(6, 4),
  correlation_btc_eth NUMERIC(6, 4),
  slippage_pct        NUMERIC(6, 4),
  dry_run             BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE trades IS 'Historique des trades par paire (CD §4.5 journal.js)';

CREATE TABLE IF NOT EXISTS events (
  id         SERIAL PRIMARY KEY,
  symbol     VARCHAR(20),
  type       VARCHAR(50) NOT NULL,
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE events IS 'Événements système SIGNAL_REJECTED, STOP, SLIPPAGE_ABORT, etc.';

CREATE TABLE IF NOT EXISTS daily_summary (
  id            SERIAL PRIMARY KEY,
  summary_date  DATE NOT NULL,
  symbol        VARCHAR(20) NOT NULL,
  trades_count  INTEGER NOT NULL DEFAULT 0,
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0,
  pnl_net       NUMERIC(18, 8) NOT NULL DEFAULT 0,
  profit_factor NUMERIC(10, 4),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (summary_date, symbol)
);

COMMENT ON TABLE daily_summary IS 'Agrégats quotidiens par paire';

CREATE TABLE IF NOT EXISTS mcp_actions (
  id         SERIAL PRIMARY KEY,
  tool       VARCHAR(50) NOT NULL,
  params     JSONB,
  result     JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE mcp_actions IS 'Audit actions MCP (CD §6.3)';

CREATE INDEX IF NOT EXISTS idx_trades_symbol_created ON trades (symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_symbol_entry_day ON trades (symbol, entry_time);
CREATE INDEX IF NOT EXISTS idx_trades_result ON trades (result);
CREATE INDEX IF NOT EXISTS idx_events_symbol_created ON events (symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (type);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date_symbol ON daily_summary (summary_date, symbol);

-- Validation schéma
INSERT INTO trades (
  symbol, entry_price, qty, result, order_type, entry_mode, dry_run, kelly_fraction
) VALUES (
  'BTCUSDT', 104500.00, 0.001, 'DRY_RUN', 'OPOCO', 'LIMIT_MAKER', true, 0.10
) ON CONFLICT DO NOTHING;

INSERT INTO events (symbol, type, payload)
VALUES ('BTCUSDT', 'SCHEMA_TEST', '{"source": "schema.sql"}'::jsonb)
ON CONFLICT DO NOTHING;
