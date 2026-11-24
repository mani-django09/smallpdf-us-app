#!/usr/bin/env python3
"""
Removes redundant window.googletag.enableServices() calls from inline AdSenseUnit
functions inside page files. _app.js is the single legitimate place it's called.
"""
import os
import glob

pages_dir = '/var/www/smallpdf.us/frontend/pages'

# Patterns to find and remove (with surrounding context to be safe)
patterns_to_remove = [
    # 8-space indent (inside cmd.push callback)
    '        window.googletag.enableServices()\n        window.googletag.display(id)',
    # 6-space indent
    '      window.googletag.enableServices()\n      window.googletag.display(id)',
]

replacements = [
    '        window.googletag.display(id)',
    '      window.googletag.display(id)',
]

skip_files = ['_app.js']

fixed = []
skipped = []

for js_file in glob.glob(os.path.join(pages_dir, '**/*.js'), recursive=True):
    filename = os.path.basename(js_file)
    if filename in skip_files:
        skipped.append(js_file)
        continue

    with open(js_file, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    for pattern, replacement in zip(patterns_to_remove, replacements):
        content = content.replace(pattern, replacement)

    if content != original:
        with open(js_file, 'w', encoding='utf-8') as f:
            f.write(content)
        fixed.append(js_file)

print(f"Fixed {len(fixed)} files:")
for f in fixed:
    print(f"  {f}")
print(f"\nSkipped (kept intact): {skip_files}")
