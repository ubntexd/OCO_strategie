const { getATR, computeATR, parseKlines } = require('../../src/atr');

describe('atr.js — CD §4.6', () => {
  const klines = [
    [0, '0', '110', '100', '105', '0', 0, '0', 0, '0', '0', '0'],
    [0, '0', '112', '101', '108', '0', 0, '0', 0, '0', '0', '0'],
    [0, '0', '115', '103', '110', '0', 0, '0', 0, '0', '0', '0'],
    [0, '0', '118', '105', '112', '0', 0, '0', 0, '0', '0', '0'],
    [0, '0', '120', '107', '115', '0', 0, '0', 0, '0', '0', '0'],
    [0, '0', '122', '109', '118', '0', 0, '0', 0, '0', '0', '0'],
    [0, '0', '125', '111', '120', '0', 0, '0', 0, '0', '0', '0'],
    [0, '0', '128', '113', '122', '0', 0, '0', 0, '0', '0', '0'],
    [0, '0', '130', '115', '125', '0', 0, '0', 0, '0', '0', '0'],
    [0, '0', '132', '117', '128', '0', 0, '0', 0, '0', '0', '0'],
    [0, '0', '135', '119', '130', '0', 0, '0', 0, '0', '0', '0'],
    [0, '0', '138', '121', '132', '0', 0, '0', 0, '0', '0', '0'],
    [0, '0', '140', '123', '135', '0', 0, '0', 0, '0', '0', '0'],
    [0, '0', '142', '125', '138', '0', 0, '0', 0, '0', '0', '0'],
    [0, '0', '145', '127', '140', '0', 0, '0', 0, '0', '0', '0'],
  ];

  test('computeATR retourne une moyenne positive', () => {
    const atr = computeATR(parseKlines(klines));
    expect(atr).toBeGreaterThan(0);
  });

  test('getATR utilise le cache Redis', async () => {
    const mockRedis = {
      get: jest.fn().mockResolvedValue('42.5'),
      setex: jest.fn(),
    };
    const mockAxios = { get: jest.fn() };
    const result = await getATR('BTCUSDT', mockRedis, mockAxios);
    expect(result).toEqual({ atr: 42.5, cached: true });
    expect(mockAxios.get).not.toHaveBeenCalled();
  });

  test('getATR appelle Binance klines si cache miss', async () => {
    const mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
    };
    const mockAxios = {
      get: jest.fn().mockResolvedValue({ data: klines }),
    };
    const result = await getATR('BTCUSDT', mockRedis, mockAxios);
    expect(result.cached).toBe(false);
    expect(result.atr).toBeGreaterThan(0);
    expect(mockAxios.get).toHaveBeenCalledWith('/api/v3/klines', {
      params: { symbol: 'BTCUSDT', interval: '5m', limit: 15 },
    });
    expect(mockRedis.setex).toHaveBeenCalledWith('atr:BTCUSDT', 300, expect.any(String));
  });
});
