#!/usr/bin/env python3
from pathlib import Path
p = Path('/home/dev/dev/OCO_strategie/tests/unit/bot.test.js')
t = p.read_text(encoding='utf-8')
if 'lrange: jest.fn()' not in t[:500]:
    t = t.replace(
        "  del: jest.fn().mockResolvedValue(1),\n  disconnect: jest.fn(),",
        "  del: jest.fn().mockResolvedValue(1),\n  lrange: jest.fn().mockResolvedValue([]),\n  disconnect: jest.fn(),",
    )
t = t.replace(
    "      incr: jest.fn(),\n    };",
    "      incr: jest.fn(),\n      lrange: jest.fn().mockResolvedValue([]),\n    };",
)
p.write_text(t, encoding='utf-8')
print('bot.test.js lrange OK')
