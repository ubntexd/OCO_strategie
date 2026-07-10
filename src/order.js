// src/order.js — CD §4.10

const crypto = require('crypto');
const axios = require('axios');
const winston = require('winston');
const journal = require('./journal');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const getDecimals = (step) => {
  const parts = step.toString().split('.');
  return parts[1]?.length || 0;
};

const roundToStep = (value, step) => {
  const decimals = getDecimals(step);
  const steps = Math.floor((value / step) + 1e-8);
  return parseFloat((steps * step).toFixed(decimals));
};

const roundToTick = (price, tickSize) => {
  const decimals = getDecimals(tickSize);
  return parseFloat((Math.round(price / tickSize) * tickSize).toFixed(decimals));
};

const getBaseUrl = () => (
  process.env.BINANCE_TESTNET === 'true'
    ? 'https://testnet.binance.vision'
    : 'https://api.binance.com'
);

const postSignedRequest = async (endpoint, params, postFn) => {
  if (postFn) return postFn(endpoint, params);

  const apiKey = process.env.BINANCE_API_KEY;
  const secret = process.env.BINANCE_API_SECRET;
  const timestamp = Date.now();
  const query = new URLSearchParams({ ...params, timestamp }).toString();
  const signature = crypto.createHmac('sha256', secret).update(query).digest('hex');
  const url = `${getBaseUrl()}${endpoint}?${query}&signature=${signature}`;
  const { data } = await axios.post(url, null, {
    headers: { 'X-MBX-APIKEY': apiKey },
  });
  return data;
};

const getExchangeFilters = async (symbol, axiosInst) => {
  const client = axiosInst || axios;
  const { data } = await client.get(`${getBaseUrl()}/api/v3/exchangeInfo`, {
    params: { symbol },
  });
  const info = data.symbols.find((s) => s.symbol === symbol);
  const lot = info.filters.find((f) => f.filterType === 'LOT_SIZE');
  const price = info.filters.find((f) => f.filterType === 'PRICE_FILTER');
  const opoAllowed = (info.orderTypes || []).includes('LIMIT_MAKER');
  return {
    tickSize: parseFloat(price.tickSize),
    stepSize: parseFloat(lot.stepSize),
    opoAllowed,
  };
};

const waitForFill = async (orderId, redis, timeoutMs) => {
  const key = `fill:${orderId}`;
  const start = Date.now();
  const POLL_INTERVAL = 200;

  while (Date.now() - start < timeoutMs) {
    const data = await redis.get(key);
    if (data) {
      await redis.del(key);
      return JSON.parse(data);
    }
    await sleep(POLL_INTERVAL);
  }
  return null;
};

const cancelOrder = async (symbol, orderId, postFn) => {
  return postSignedRequest('/api/v3/order', {
    symbol, orderId, action: 'cancel',
  }, postFn);
};

const cancelAllOrders = async (symbol, postFn) => {
  const open = await getOpenOrders(symbol, postFn);
  for (const o of open) {
    await cancelOrder(symbol, o.orderId, postFn);
  }
};

const getOpenOrders = async (symbol, postFn) => {
  if (postFn) {
    return postFn('/api/v3/openOrders', { symbol }) || [];
  }
  const apiKey = process.env.BINANCE_API_KEY;
  const { data } = await axios.get(`${getBaseUrl()}/api/v3/openOrders`, {
    params: { symbol },
    headers: { 'X-MBX-APIKEY': apiKey },
  });
  return data;
};

const placeMarketSell = async (symbol, qty, filters, postFn) => {
  const stepSize = filters?.stepSize || 0.00001;
  const qtyRounded = roundToStep(qty, stepSize);
  return postSignedRequest('/api/v3/order', {
    symbol,
    side: 'SELL',
    type: 'MARKET',
    quantity: qtyRounded.toFixed(getDecimals(stepSize)),
  }, postFn);
};

const handleMarketFill = async (symbol, qty, fillPrice, expectedPrice, filters, postFn) => {
  const slippage = Math.abs((fillPrice - expectedPrice) / expectedPrice) * 100;
  const MAX_SLIPPAGE = parseFloat(process.env.MAX_SLIPPAGE_PCT || '0.20');
  if (slippage > MAX_SLIPPAGE) {
    logger.error(`[${symbol}] Slippage excessif (${slippage.toFixed(2)}%) — sortie immédiate`);
    await module.exports.placeMarketSell(symbol, qty, filters, postFn);
    await journal.logSlippageAbort(symbol, fillPrice, expectedPrice, slippage);
    return null;
  }
  return { fillPrice, quantity: qty, mode: 'MARKET', slippage };
};

const placeEntry = async (symbol, qty, entryPrice, filters, redis, postFn) => {
  if (process.env.DRY_RUN === 'true') {
    logger.info(`[DRY_RUN] Signal BUY ${symbol} @ ${entryPrice}`);
    await journal.logDryRun(symbol, entryPrice, qty);
    return { simulated: true };
  }

  const qtyRounded = roundToStep(qty, filters.stepSize);
  const priceRounded = roundToTick(entryPrice, filters.tickSize);

  const order = await postSignedRequest('/api/v3/order', {
    symbol,
    side: 'BUY',
    type: 'LIMIT_MAKER',
    quantity: qtyRounded.toFixed(getDecimals(filters.stepSize)),
    price: priceRounded.toFixed(getDecimals(filters.tickSize)),
    newOrderRespType: 'RESULT',
  }, postFn);

  const ENTRY_TIMEOUT = parseInt(process.env.ENTRY_TIMEOUT || '45', 10);
  const filled = await waitForFill(order.orderId, redis, ENTRY_TIMEOUT * 1000);

  if (!filled) {
    logger.warn(`[${symbol}] LIMIT_MAKER non fillé après ${ENTRY_TIMEOUT}s — fallback MARKET`);
    await cancelOrder(symbol, order.orderId, postFn);

    const marketOrder = await postSignedRequest('/api/v3/order', {
      symbol,
      side: 'BUY',
      type: 'MARKET',
      quantity: qtyRounded.toFixed(getDecimals(filters.stepSize)),
    }, postFn);

    const fillPrice = parseFloat(marketOrder.fills[0].price);
    const result = await handleMarketFill(symbol, qtyRounded, fillPrice, priceRounded, filters, postFn);
    if (!result) return null;

    return {
      orderId: marketOrder.orderId,
      fillPrice: result.fillPrice,
      quantity: qtyRounded,
      mode: 'MARKET',
      slippage: result.slippage,
      timestamp: Date.now(),
    };
  }

  return {
    orderId: order.orderId,
    fillPrice: parseFloat(filled.price),
    quantity: parseFloat(filled.quantity),
    mode: 'LIMIT_MAKER',
    slippage: 0,
    timestamp: Date.now(),
  };
};

const placeOPOCO = async (symbol, qty, entryFillPrice, tpPrice, slPrice, filters, postFn) => {
  const tickDec = getDecimals(filters.tickSize);
  const stepDec = getDecimals(filters.stepSize);

  const payload = {
    symbol,
    workingType: 'LIMIT_MAKER',
    workingSide: 'BUY',
    workingPrice: roundToTick(entryFillPrice, filters.tickSize).toFixed(tickDec),
    workingQuantity: qty.toFixed(stepDec),
    workingTimeInForce: 'GTC',
    pendingSide: 'SELL',
    pendingAboveType: 'LIMIT',
    pendingAbovePrice: roundToTick(tpPrice, filters.tickSize).toFixed(tickDec),
    pendingAboveTimeInForce: 'GTC',
    pendingBelowType: 'STOP_LOSS',
    pendingBelowStopPrice: roundToTick(slPrice, filters.tickSize).toFixed(tickDec),
    newOrderRespType: 'RESULT',
  };

  return postSignedRequest('/api/v3/orderList/opoco', payload, postFn);
};

const placeOCO = async (symbol, qty, entryFillPrice, tpPrice, slPrice, filters, postFn) => {
  const tickDec = getDecimals(filters.tickSize);
  const stepDec = getDecimals(filters.stepSize);
  const qtyStr = roundToStep(qty, filters.stepSize).toFixed(stepDec);
  const tpStr = roundToTick(tpPrice, filters.tickSize).toFixed(tickDec);
  const slStr = roundToTick(slPrice, filters.tickSize).toFixed(tickDec);

  return postSignedRequest('/api/v3/orderList/oco', {
    symbol,
    side: 'SELL',
    quantity: qtyStr,
    price: tpStr,
    stopPrice: slStr,
    stopLimitPrice: slStr,
    stopLimitTimeInForce: 'GTC',
    newOrderRespType: 'RESULT',
  }, postFn);
};

module.exports = {
  getExchangeFilters,
  placeEntry,
  placeOPOCO,
  placeOCO,
  cancelOrder,
  cancelAllOrders,
  getOpenOrders,
  placeMarketSell,
  waitForFill,
  roundToStep,
  roundToTick,
  getDecimals,
  handleMarketFill,
  postSignedRequest,
};
