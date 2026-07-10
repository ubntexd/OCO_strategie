#!/usr/bin/env python3
"""Audit fixes — BotTrader v1.0"""
import json
from pathlib import Path

ROOT = Path('/home/dev/dev/OCO_strategie')

# 1. journal.js
jpath = ROOT / 'src/journal.js'
j = jpath.read_text(encoding='utf-8')

old_open = """const logTradeOpen = async (pgPool, symbol, price, qty, tp, sl, atr, kellyFraction) => {
  const result = await pgPool.query(
    `INSERT INTO trades (
       symbol, entry_price, qty, result, order_type, entry_mode,
       regime, kelly_fraction, dry_run
     ) VALUES ($1, $2, $3, 'OPEN', 'OPOCO', 'LIMIT_MAKER', NULL, $4, $5)
     RETURNING id`,
    [symbol, price, qty, kellyFraction, process.env.DRY_RUN === 'true'],
  );"""

new_open = """const logTradeOpen = async (pgPool, symbol, price, qty, tp, sl, atr, kellyFraction, correlationBtcEth = null) => {
  const result = await pgPool.query(
    `INSERT INTO trades (
       symbol, entry_price, qty, result, order_type, entry_mode,
       regime, kelly_fraction, correlation_btc_eth, dry_run
     ) VALUES ($1, $2, $3, 'OPEN', 'OPOCO', 'LIMIT_MAKER', NULL, $4, $5, $6)
     RETURNING id`,
    [symbol, price, qty, kellyFraction, correlationBtcEth, process.env.DRY_RUN === 'true'],
  );"""

if old_open not in j:
    raise SystemExit('journal logTradeOpen block not found')
j = j.replace(old_open, new_open)

upsert = """
const upsertDailySummary = async (pgPool, symbol, pnlNet, result) => {
  const win = result === 'TP' ? 1 : 0;
  const loss = result === 'SL' ? 1 : 0;
  await pgPool.query(
    `INSERT INTO daily_summary (summary_date, symbol, trades_count, wins, losses, pnl_net)
     VALUES (CURRENT_DATE, $1, 1, $2, $3, $4)
     ON CONFLICT (summary_date, symbol) DO UPDATE SET
       trades_count = daily_summary.trades_count + 1,
       wins = daily_summary.wins + EXCLUDED.wins,
       losses = daily_summary.losses + EXCLUDED.losses,
       pnl_net = daily_summary.pnl_net + EXCLUDED.pnl_net`,
    [symbol, win, loss, pnlNet],
  );
};

"""

if 'upsertDailySummary' not in j:
    j = j.replace('const logTradeClose = async', upsert + 'const logTradeClose = async')

marker = "  const total = await redis.incr('bot:global:total_trades');"
if 'upsertDailySummary(pgPool' not in j:
    j = j.replace(
        marker,
        "  await upsertDailySummary(pgPool, symbol, closeData.pnlNet, closeData.result);\n\n" + marker,
    )

jpath.write_text(j, encoding='utf-8')
print('journal.js OK')

# 2. bot.js
bpath = ROOT / 'src/bot.js'
b = bpath.read_text(encoding='utf-8')
if 'corrBtcEth' not in b:
    if "const correlation = require('./correlation');" not in b:
        b = b.replace(
            "const journal = require('./journal');",
            "const journal = require('./journal');\nconst correlation = require('./correlation');",
        )
    old_call = """  const tradeId = await journal.logTradeOpen(
    pgPool, symbol, entry.fillPrice, entry.quantity, tp, sl, atrData.atr, kellyFraction,
  );"""
    new_call = """  const corrBtcEth = await correlation.getPairCorrelation('BTCUSDT', 'ETHUSDT', 20, redis);
  const tradeId = await journal.logTradeOpen(
    pgPool, symbol, entry.fillPrice, entry.quantity, tp, sl, atrData.atr, kellyFraction, corrBtcEth,
  );"""
    if old_call not in b:
        raise SystemExit('bot logTradeOpen call not found')
    b = b.replace(old_call, new_call)
    bpath.write_text(b, encoding='utf-8')
print('bot.js OK')

# 3. wf5
wf5 = {
    'name': 'WF5 — Reset Daily',
    'nodes': [
        {'parameters': {'rule': {'interval': [{'field': 'cronExpression', 'expression': '1 0 * * *'}]}},
         'id': 'cron', 'name': 'Cron 00h01 UTC', 'type': 'n8n-nodes-base.scheduleTrigger',
         'typeVersion': 1.2, 'position': [0, 0]},
        {'parameters': {'method': 'POST', 'url': 'http://bot_btc:4001/config', 'sendHeaders': True,
         'headerParameters': {'parameters': [
             {'name': 'x-bot-token', 'value': '={{$env.RESTART_SECRET}}'},
             {'name': 'Content-Type', 'value': 'application/json'}]},
         'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={"key":"reset_daily"}'},
         'id': 'reset-btc', 'name': 'Reset BTC', 'type': 'n8n-nodes-base.httpRequest',
         'typeVersion': 4.2, 'position': [220, 0]},
        {'parameters': {'method': 'POST', 'url': 'http://bot_eth:4002/config', 'sendHeaders': True,
         'headerParameters': {'parameters': [
             {'name': 'x-bot-token', 'value': '={{$env.RESTART_SECRET}}'},
             {'name': 'Content-Type', 'value': 'application/json'}]},
         'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={"key":"reset_daily"}'},
         'id': 'reset-eth', 'name': 'Reset ETH', 'type': 'n8n-nodes-base.httpRequest',
         'typeVersion': 4.2, 'position': [440, 0]},
        {'parameters': {'method': 'POST', 'url': 'http://bot_sol:4003/config', 'sendHeaders': True,
         'headerParameters': {'parameters': [
             {'name': 'x-bot-token', 'value': '={{$env.RESTART_SECRET}}'},
             {'name': 'Content-Type', 'value': 'application/json'}]},
         'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={"key":"reset_daily"}'},
         'id': 'reset-sol', 'name': 'Reset SOL', 'type': 'n8n-nodes-base.httpRequest',
         'typeVersion': 4.2, 'position': [660, 0]},
        {'parameters': {'chatId': '={{$env.TELEGRAM_CHAT_ID}}',
         'text': '✅ reset_daily appliqué sur BTC + ETH + SOL'},
         'id': 'tg', 'name': 'Telegram', 'type': 'n8n-nodes-base.telegram',
         'typeVersion': 1.2, 'position': [880, 0]},
    ],
    'connections': {
        'Cron 00h01 UTC': {'main': [[{'node': 'Reset BTC', 'type': 'main', 'index': 0}]]},
        'Reset BTC': {'main': [[{'node': 'Reset ETH', 'type': 'main', 'index': 0}]]},
        'Reset ETH': {'main': [[{'node': 'Reset SOL', 'type': 'main', 'index': 0}]]},
        'Reset SOL': {'main': [[{'node': 'Telegram', 'type': 'main', 'index': 0}]]},
    },
    'settings': {'executionOrder': 'v1'},
    'meta': {'description': 'CD §8.7 WF5 — POST /config reset_daily sur les 3 bots'},
}
(ROOT / 'n8n/workflows/wf5_reset_daily.json').write_text(
    json.dumps(wf5, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print('wf5 OK')

# 4. CDC ports
cdc_path = ROOT / 'docs/CAHIER_DES_CHARGES.md'
cdc = cdc_path.read_text(encoding='utf-8')
cdc_path.write_text(cdc.replace('5433', '5435'), encoding='utf-8')
print('CDC ports OK')

# 5. ETAT_PROJET
etat_path = ROOT / 'docs/ETAT_PROJET.md'
etat = etat_path.read_text(encoding='utf-8')
etat = etat.replace('f2e5f6f', 'd2de46e')
etat = etat.replace('EN ATTENTE DÉMARRAGE BOT', 'BOT BTC DRY_RUN ACTIF — ETH/SOL À DÉMARRER')
etat = etat.replace(
    '| `bot_btc` | 4001 | `btc` | ⏸ À démarrer |',
    '| `bot_btc` | 4001 | `btc` | ✅ ACTIF (DRY_RUN) |',
)
if 'RAPPORT_AUDIT_COHERENCE' not in etat:
    etat = etat.replace(
        '## 0. RÉSUMÉ EXÉCUTIF',
        '## 0. RÉSUMÉ EXÉCUTIF\n\n> Dernier audit cohérence : 10/07/2026 — `docs/rapports/RAPPORT_AUDIT_COHERENCE.md`',
    )
etat_path.write_text(etat, encoding='utf-8')
print('ETAT_PROJET OK')
