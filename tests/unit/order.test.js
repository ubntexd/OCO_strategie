jest.mock('../../src/journal', () => ({
  logDryRun: jest.fn().mockResolvedValue(),
  logSlippageAbort: jest.fn().mockResolvedValue(),
}));

const order = require('../../src/order');
const journal = require('../../src/journal');

describe('order.js — CD §4.10', () => {
  const filters = { tickSize: 0.01, stepSize: 0.00001, opoAllowed: true };

  describe('placeOPOCO', () => {
    test('payload sans pendingQuantity (CDC v1.1 §17 C2)', async () => {
      const mockPost = jest.fn().mockResolvedValue({ orderListId: 1 });
      await order.placeOPOCO('BTCUSDT', 0.0572, 104650, 104932, 104200, filters, mockPost);
      expect(mockPost.mock.calls[0][1]).not.toHaveProperty('pendingQuantity');
    });

    test('TP en LIMIT GTC (pas LIMIT_MAKER)', async () => {
      const mockPost = jest.fn().mockResolvedValue({ orderListId: 1 });
      await order.placeOPOCO('BTCUSDT', 0.0572, 104650, 104932, 104200, filters, mockPost);
      const payload = mockPost.mock.calls[0][1];
      expect(payload.pendingAboveType).toBe('LIMIT');
      expect(payload.pendingAboveTimeInForce).toBe('GTC');
    });

    test('entrée en LIMIT_MAKER', async () => {
      const mockPost = jest.fn().mockResolvedValue({ orderListId: 1 });
      await order.placeOPOCO('BTCUSDT', 0.0572, 104650, 104932, 104200, filters, mockPost);
      expect(mockPost.mock.calls[0][1].workingType).toBe('LIMIT_MAKER');
    });
  });

  describe('roundToStep', () => {
    test('0.57234 avec step 0.00001 → pas de floating point', () => {
      expect(order.roundToStep(0.57234, 0.00001)).toBe(0.57234);
    });

    test('0.99999 avec step 0.0001 → floor correct', () => {
      expect(order.roundToStep(0.99999, 0.0001)).toBe(0.9999);
    });
  });

  describe('slippage MARKET', () => {
    test('slippage > MAX_SLIPPAGE_PCT déclenche placeMarketSell', async () => {
      process.env.MAX_SLIPPAGE_PCT = '0.20';
      const mockSell = jest.spyOn(order, 'placeMarketSell').mockResolvedValue({});
      const mockLog = jest.spyOn(journal, 'logSlippageAbort').mockResolvedValue();
      const result = await order.handleMarketFill('BTCUSDT', 0.0572, 104870, 104650, filters, jest.fn());
      expect(result).toBeNull();
      expect(mockSell).toHaveBeenCalled();
      expect(mockLog).toHaveBeenCalled();
      mockSell.mockRestore();
      mockLog.mockRestore();
    });
  });

  describe('DRY_RUN', () => {
    test('DRY_RUN=true retourne {simulated:true} sans appel API', async () => {
      process.env.DRY_RUN = 'true';
      const mockPost = jest.fn();
      const result = await order.placeEntry('BTCUSDT', 0.05, 104650, filters, {}, mockPost);
      expect(result).toEqual({ simulated: true });
      expect(mockPost).not.toHaveBeenCalled();
      delete process.env.DRY_RUN;
    });
  });

  describe('getExchangeFilters', () => {
    test('parse exchangeInfo Binance', async () => {
      const mockAxios = {
        get: jest.fn().mockResolvedValue({
          data: {
            symbols: [{
              symbol: 'BTCUSDT',
              orderTypes: ['LIMIT', 'LIMIT_MAKER', 'MARKET'],
              filters: [
                { filterType: 'LOT_SIZE', stepSize: '0.00001000' },
                { filterType: 'PRICE_FILTER', tickSize: '0.01000000' },
              ],
            }],
          },
        }),
      };
      const f = await order.getExchangeFilters('BTCUSDT', mockAxios);
      expect(f.stepSize).toBe(0.00001);
      expect(f.tickSize).toBe(0.01);
      expect(f.opoAllowed).toBe(true);
    });
  });

  describe('placeEntry live', () => {
    test('retourne LIMIT_MAKER si fill immédiat', async () => {
      process.env.DRY_RUN = 'false';
      const mockPost = jest.fn().mockResolvedValue({ orderId: 123 });
      const fill = JSON.stringify({ orderId: 123, price: '100', quantity: '0.05' });
      const mockRedis = {
        get: jest.fn().mockResolvedValue(fill),
        del: jest.fn().mockResolvedValue(1),
      };
      const result = await order.placeEntry('BTCUSDT', 0.05, 100, filters, mockRedis, mockPost);
      expect(result.mode).toBe('LIMIT_MAKER');
      expect(result.fillPrice).toBe(100);
      delete process.env.DRY_RUN;
    });

    test('fallback MARKET si timeout fill', async () => {
      process.env.DRY_RUN = 'false';
      process.env.ENTRY_TIMEOUT = '0';
      process.env.MAX_SLIPPAGE_PCT = '1';
      const mockPost = jest.fn()
        .mockResolvedValueOnce({ orderId: 1 })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ orderId: 2, fills: [{ price: '100.05' }] });
      const mockRedis = { get: jest.fn().mockResolvedValue(null), del: jest.fn() };
      const result = await order.placeEntry('BTCUSDT', 0.05, 100, filters, mockRedis, mockPost);
      expect(result.mode).toBe('MARKET');
      delete process.env.DRY_RUN;
    });
  });

  describe('placeOCO', () => {
    test('appelle orderList/oco', async () => {
      const mockPost = jest.fn().mockResolvedValue({ orderListId: 2 });
      await order.placeOCO('BTCUSDT', 0.05, 100, 128, 82, filters, mockPost);
      expect(mockPost).toHaveBeenCalledWith('/api/v3/orderList/oco', expect.objectContaining({
        symbol: 'BTCUSDT', side: 'SELL',
      }));
    });
  });

  describe('cancelAllOrders', () => {
    test('annule tous les ordres ouverts', async () => {
      const mockPost = jest.fn()
        .mockResolvedValueOnce([{ orderId: 1 }, { orderId: 2 }])
        .mockResolvedValue({});
      await order.cancelAllOrders('BTCUSDT', mockPost);
      expect(mockPost).toHaveBeenCalledTimes(3);
    });
  });

  describe('placeMarketSell', () => {
    test('envoie ordre MARKET SELL', async () => {
      const mockPost = jest.fn().mockResolvedValue({ orderId: 9 });
      await order.placeMarketSell('BTCUSDT', 0.05, filters, mockPost);
      expect(mockPost).toHaveBeenCalledWith('/api/v3/order', expect.objectContaining({
        side: 'SELL', type: 'MARKET',
      }));
    });
  });

  describe('postSignedRequest', () => {
    test('délègue à postFn si fourni', async () => {
      const mockPost = jest.fn().mockResolvedValue({ ok: true });
      const result = await order.postSignedRequest('/api/v3/order', { symbol: 'BTCUSDT' }, mockPost);
      expect(mockPost).toHaveBeenCalled();
      expect(result.ok).toBe(true);
    });

    test('appelle axios si pas de postFn', async () => {
      process.env.BINANCE_API_KEY = 'key';
      process.env.BINANCE_API_SECRET = 'secret';
      process.env.BINANCE_TESTNET = 'true';
      const axios = require('axios');
      const spy = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 1 } });
      const result = await order.postSignedRequest('/api/v3/order', { symbol: 'BTCUSDT' });
      expect(result.id).toBe(1);
      spy.mockRestore();
    });
  });

  describe('getOpenOrders', () => {
    test('appelle axios si pas de postFn', async () => {
      process.env.BINANCE_API_KEY = 'key';
      process.env.BINANCE_TESTNET = 'true';
      const axios = require('axios');
      const spy = jest.spyOn(axios, 'get').mockResolvedValue({ data: [{ orderId: 1 }] });
      const result = await order.getOpenOrders('BTCUSDT');
      expect(result).toHaveLength(1);
      spy.mockRestore();
    });
  });

  describe('cancelOrder', () => {
    test('appelle API cancel', async () => {
      const mockPost = jest.fn().mockResolvedValue({});
      await order.cancelOrder('BTCUSDT', 42, mockPost);
      expect(mockPost).toHaveBeenCalledWith('/api/v3/order', expect.objectContaining({
        symbol: 'BTCUSDT', orderId: 42,
      }));
    });
  });

  describe('waitForFill', () => {
    test('retourne fill si Redis alimenté', async () => {
      const fill = JSON.stringify({ orderId: 1, price: '100', quantity: '0.01' });
      const mockRedis = {
        get: jest.fn().mockResolvedValueOnce(fill),
        del: jest.fn().mockResolvedValue(1),
      };
      const result = await order.waitForFill(1, mockRedis, 1000);
      expect(result.price).toBe('100');
    });

    test('retourne null si timeout', async () => {
      const mockRedis = { get: jest.fn().mockResolvedValue(null) };
      const result = await order.waitForFill(99, mockRedis, 100);
      expect(result).toBeNull();
    });
  });
});
