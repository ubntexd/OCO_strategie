/**
 * Seuils couverture CD §9.1 — seule source autorisée
 */
const COVERAGE_MIN = {
  'db/schema.sql': null,
  'src/kelly.js': 95,
  'src/journal.js': 80,
  'src/atr.js': 90,
  'src/regime.js': 85,
  'src/correlation.js': 85,
  'src/protection.js': 90,
  'src/health.js': 80,
  'src/order.js': 90,
  'src/monitor.js': 80,
  'src/signal.js': 95,
  'src/bot.js': 80,
  'mcp/server.js': 80,
  'mcp/lib/sqlGuard.js': 90,
  'mcp/lib/tools.js': 85,
  'dashboard/server.js': 80,
  'dashboard/api/backtest.js': 85,
  'n8n/workflows': null,
};

const TASK_TEST_MAP = {
  'mcp/server.js': 'tests/unit/mcp.test.js',
  'dashboard/server.js': 'tests/unit/dashboard.test.js',
  'dashboard/api/backtest.js': 'tests/unit/backtest.test.js',
  'n8n/workflows': 'tests/unit/n8n-workflows.test.js',
};

const EXPORTS_REQUIRED = {
  'src/kelly.js': ['computeKellyFormula', 'computeKellyAuto'],
  'src/journal.js': [
    'logTradeOpen', 'logTradeFill', 'logTradeClose', 'logEvent',
    'logDryRun', 'logSlippageAbort', 'logForcedExit',
    'getDayPnl', 'getConsecLoss', 'getTotalTrades', 'getProfitFactor',
  ],
  'src/atr.js': ['getATR'],
  'src/regime.js': ['getRegime', 'checkTrendDown'],
  'src/correlation.js': ['getPairCorrelation', 'shouldBlockOnCorrelation'],
  'src/protection.js': [
    'checkAndLock', 'isGloballyLocked', 'isPairLocked',
    'checkPositionTimeout', 'resetDailyLocks',
  ],
  'src/health.js': ['startHealthServer', 'createHealthApp'],
  'src/order.js': [
    'getExchangeFilters', 'placeEntry', 'placeOPOCO', 'placeOCO',
    'cancelOrder', 'cancelAllOrders', 'getOpenOrders', 'placeMarketSell', 'waitForFill',
  ],
  'src/monitor.js': ['startMonitor', 'stopMonitor', 'waitForResult'],
  'src/signal.js': ['evaluateSignal'],
  'src/bot.js': ['run', 'gracefulShutdown', 'validateRequiredEnv', 'processTradingCycle'],
  'mcp/server.js': ['createMcpApp', 'startMcpServer'],
  'dashboard/server.js': ['createDashboardApp', 'startDashboardServer', 'buildRealtimeData'],
};

function getCoverageMin(task) {
  if (task in COVERAGE_MIN) return COVERAGE_MIN[task];
  if (task.startsWith('n8n/workflows')) return null;
  return 80;
}

function resolveTestFile(task) {
  if (TASK_TEST_MAP[task]) return TASK_TEST_MAP[task];
  if (task.startsWith('n8n/workflows')) return TASK_TEST_MAP['n8n/workflows'];
  return task.replace('src/', 'tests/unit/').replace('.js', '.test.js');
}

module.exports = {
  COVERAGE_MIN, EXPORTS_REQUIRED, TASK_TEST_MAP, getCoverageMin, resolveTestFile,
};
