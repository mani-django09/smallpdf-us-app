#!/usr/bin/env python3
"""
Fixes all preview.js tool pages to send auth token with API requests.
- Adds: import { useAuth } from "../../context/AuthContext"
- Adds: const { authFetch } = useAuth()
- Replaces: await fetch(`${...}/api/...) with authFetch
- Special case: ocr-pdf already has useAuth but uses wrong user?.token pattern
"""
import os, re

BASE = '/var/www/smallpdf.us/frontend/pages'

# Files and their specific API fetch patterns
FILES = [
    'compress-pdf/preview.js',
    'compress-image/preview.js',
    'excel-to-pdf/preview.js',
    'jpg-to-pdf/preview.js',
    'pdf-to-jpg/preview.js',
    'pdf-to-excel/preview.js',
    'png-to-webp/preview.js',
    'pdf-to-word/preview.js',
    'word-to-pdf/preview.js',
    'pdf-to-ppt/preview.js',
    'png-to-pdf/preview.js',
    'webp-to-png/preview.js',
    'unlock-pdf/preview.js',
    'ppt-to-pdf/preview.js',
    'split-pdf/preview.js',
]

OCR_FILE = 'ocr-pdf/preview.js'

fixed = []
errors = []

def fix_standard(path):
    with open(path) as f:
        c = f.read()
    orig = c

    # 1. Add useAuth import if not present (before export default function)
    if 'useAuth' not in c:
        c = c.replace(
            'export default function',
            'import { useAuth } from "../../context/AuthContext"\n\nexport default function',
            1
        )

    # 2. Add authFetch hook if not present (after const router = useLocalizedRouter())
    if 'authFetch' not in c:
        c = c.replace(
            'const router = useLocalizedRouter()',
            'const router = useLocalizedRouter()\n  const { authFetch } = useAuth()',
            1
        )

    # 3. Replace await fetch( with await authFetch( for /api/ calls only
    # Match: await fetch(`${...}/api/ or await fetch(`${getApiUrl()}/api/
    c = re.sub(
        r'await fetch\(`(\$\{[^`]+\})/api/',
        r'await authFetch(`\1/api/',
        c
    )

    if c != orig:
        with open(path, 'w') as f:
            f.write(c)
        return True
    return False

def fix_ocr(path):
    with open(path) as f:
        c = f.read()
    orig = c

    # Already has: const { user } = useAuth()
    # Change to:   const { user, authFetch } = useAuth()
    c = c.replace(
        'const { user } = useAuth()',
        'const { user, authFetch } = useAuth()'
    )

    # Replace the fetch call that has manual auth header
    # From: await fetch(`${API_URL}/api/ocr-pdf`, { ... headers: user?.token ? ... })
    # To:   await authFetch(...) without manual headers
    c = re.sub(
        r"await fetch\(`(\$\{[^`]+\})/api/ocr-pdf`,\s*\{(.*?)headers:\s*user\?\.token\s*\?[^\}]+\}\s*:\s*\{\},?\s*\}\)",
        r"await authFetch(`\1/api/ocr-pdf`, {\2})",
        c,
        flags=re.DOTALL
    )

    # Fallback: simple replace if regex above didn't match
    if 'user?.token' in c:
        c = re.sub(
            r'await fetch\(`(\$\{[^`]+\})/api/ocr-pdf`',
            r'await authFetch(`\1/api/ocr-pdf`',
            c
        )
        # Remove the manual headers line
        c = re.sub(
            r'\s*headers:\s*user\?\.token\s*\?[^\n]+\n?',
            '\n',
            c
        )

    if c != orig:
        with open(path, 'w') as f:
            f.write(c)
        return True
    return False

# Fix standard files
for rel in FILES:
    path = os.path.join(BASE, rel)
    try:
        changed = fix_standard(path)
        if changed:
            fixed.append(rel)
            print(f'  ✓ Fixed: {rel}')
        else:
            print(f'  ~ Already OK: {rel}')
    except Exception as e:
        errors.append(f'{rel}: {e}')
        print(f'  ✗ Error: {rel}: {e}')

# Fix ocr-pdf specially
path = os.path.join(BASE, OCR_FILE)
try:
    changed = fix_ocr(path)
    if changed:
        fixed.append(OCR_FILE)
        print(f'  ✓ Fixed (special): {OCR_FILE}')
    else:
        print(f'  ~ Already OK: {OCR_FILE}')
except Exception as e:
    errors.append(f'{OCR_FILE}: {e}')
    print(f'  ✗ Error: {OCR_FILE}: {e}')

print(f'\nTotal fixed: {len(fixed)}/16')
if errors:
    print(f'Errors: {errors}')
