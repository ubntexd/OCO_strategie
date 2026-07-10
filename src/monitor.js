// src/monitor.js — CD §4.11

const WebSocket = require('ws');
const axios = require('axios');
const winston = require('winston');
const { notifyTelegram } = require('./notify');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsInstances = [];
let keepAliveTimer = null;
let listenKey = null;

const getBaseUrl = () => (
  process.env.BINANCE_TESTNET === 'true'
    ? 'https://testnet.binance.vision'
    : 'https://api.binance.com'
);

const getWsBase = () => (
  process.env.BINANCE_TESTNET === 'true'
    ? 'wss://testnet.binance.vision'
    : 'wss://stream.binance.com:9443'
);

const handleExecutionReport = async (report, redis) => {
  const {
    orderId, orderListId, status, side, price, executedQty, commission,
  } = report;
  const listId = parseInt(orderListId, 10);

  if (status === 'FILLED' && (listId === -1 || orderListId === -1)) {
    await redis.setex(`fill:${orderId}`, 120, JSON.stringify({
      orderId, price, quantity: executedQty, commission,
    }));
    return;
  }

  if (status === 'FILLED' && listId !== -1 && side === 'SELL') {
    const tpPrice = parseFloat(await redis.get(`tp:${orderListId}`) || '0');
    const result = parseFloat(price) >= tpPrice ? 'TP' : 'SL';

    await redis.setex(`result:${orderListId}`, 300, JSON.stringify({
      result,
      exitPrice: parseFloat(price),
      quantity: parseFloat(executedQty),
      fees: parseFloat(commission),
    }));
  }
};

const waitForResult = async (orderListId, redis, timeoutMs = 86400000) => {
  const key = `result:${orderListId}`;
  const start = Date.now();
  const POLL_INTERVAL = 500;

  while (Date.now() - start < timeoutMs) {
    const data = await redis.get(key);
    if (data) {
      await redis.del(key);
      return JSON.parse(data);
    }
    await sleep(POLL_INTERVAL);
  }

  throw new Error(`waitForResult timeout orderListId=${orderListId}`);
};

const handleBookTicker = async (data, symbol, redis) => {
  await redis.set(`bid:${symbol}`, data.b);
  await redis.set(`ask:${symbol}`, data.a);
};

const handleKline = async (data, symbol, redis) => {
  const kline = data.k;
  if (kline.x === true) {
    await redis.lpush(`closes:${symbol}`, parseFloat(kline.c).toString());
    await redis.ltrim(`closes:${symbol}`, 0, 49);
    await redis.set(`volume_current:${symbol}`, kline.v);
  }
};

const createListenKey = async () => {
  const apiKey = process.env.BINANCE_API_KEY;
  const { data } = await axios.post(
    `${getBaseUrl()}/api/v3/userDataStream`,
    null,
    { headers: { 'X-MBX-APIKEY': apiKey } },
  );
  return data.listenKey;
};

const keepAliveListenKey = async (key) => {
  const apiKey = process.env.BINANCE_API_KEY;
  await axios.put(`${getBaseUrl()}/api/v3/userDataStream`, null, {
    params: { listenKey: key },
    headers: { 'X-MBX-APIKEY': apiKey },
  });
};

const connectWithRetry = async (url, onMessage, symbol, maxRetries = 5) => {
  let attempt = 0;

  const connect = () => new Promise((resolve) => {
    const ws = new WebSocket(url);
    wsInstances.push(ws);

    ws.on('message', (raw) => {
      try {
        onMessage(JSON.parse(raw.toString()));
      } catch (err) {
        logger.error(`[${symbol}] WS parse erreur: ${err.message}`);
      }
    });

    ws.on('open', () => {
      attempt = 0;
      resolve(ws);
    });

    ws.on('close', async () => {
      if (attempt >= maxRetries) {
        logger.error(`[${symbol}] WS non récupérable après ${maxRetries} tentatives`);
        await notifyTelegram(`⛔ [${symbol}] WebSocket irrécupérable — intervention requise`);
        return;
      }
      attempt += 1;
      const delay = Math.min(1000 * 2 ** attempt, 30000);
      logger.warn(`[${symbol}] WS déconnecté — retry ${attempt}/${maxRetries} dans ${delay}ms`);
      await sleep(delay);
      await connect();
    });

    ws.on('error', (err) => logger.error(`[${symbol}] WS erreur: ${err.message}`));
  });

  return connect();
};

const startMonitor = async (symbol, redis) => {
  const sym = symbol.toLowerCase();

  if (process.env.DRY_RUN !== 'true') {
    listenKey = await createListenKey();

    keepAliveTimer = setInterval(() => {
      keepAliveListenKey(listenKey).catch((err) => {
        logger.error(`[${symbol}] keepAlive listenKey: ${err.message}`);
      });
    }, 20 * 60 * 1000);
  } else {
    logger.info(`[${symbol}] DRY_RUN — userDataStream ignoré`);
  }

  await connectWithRetry(
    `${getWsBase()}/ws/${sym}@bookTicker`,
    async (msg) => handleBookTicker(msg, symbol, redis),
    symbol,
  );

  await connectWithRetry(
    `${getWsBase()}/ws/${sym}@kline_5m`,
    async (msg) => handleKline(msg, symbol, redis),
    symbol,
  );

  if (process.env.DRY_RUN !== 'true') {
    await connectWithRetry(
      `${getWsBase()}/ws/${listenKey}`,
      async (msg) => {
        if (msg.e === 'executionReport') {
          await handleExecutionReport(msg, redis);
        }
      },
      symbol,
    );
  }
};

const stopMonitor = async () => {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
  for (const ws of wsInstances) {
    if (ws.readyState === WebSocket.OPEN) ws.close();
  }
  wsInstances = [];
  listenKey = null;
};

module.exports = {
  startMonitor,
  stopMonitor,
  waitForResult,
  handleExecutionReport,
  handleBookTicker,
  handleKline,
};
