#!/usr/bin/env python3
from pathlib import Path
import re
p = Path('/home/dev/dev/OCO_strategie/tests/unit/bot.test.js')
t = p.read_text(encoding='utf-8')
# Add lrange to inline mockRedis blocks missing it
t = re.sub(
    r'(const mockRedis = \{[^}]*?incr: jest\.fn\(\)(?:\.mockResolvedValue\(\d+\))?,\n)(\s*\};)',
    r'\1      lrange: jest.fn().mockResolvedValue([]),\n\2',
    t,
)
t = re.sub(
    r'(set: jest\.fn\(\), setex: jest\.fn\(\), del: jest\.fn\(\), incr: jest\.fn\(\),)(\n\s*\};)',
    r'\1 lrange: jest.fn().mockResolvedValue([]),\2',
    t,
)
p.write_text(t, encoding='utf-8')
print('bot.test.js patched')
