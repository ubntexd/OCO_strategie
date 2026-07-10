#!/usr/bin/env python3
import re
from pathlib import Path

text = Path('.env.shared').read_text()
m = re.search(r'^ANTHROPIC_API_KEY=(.*)$', text, re.M)
if not m:
    print('KEY: missing')
else:
    v = m.group(1).strip().strip('"').strip("'")
    print('KEY: found')
    print('length:', len(v))
    print('starts sk-ant:', v.startswith('sk-ant'))
    print('has_spaces:', ' ' in v)
    print('line_ends_ok:', not v.endswith('\r'))
