#!/usr/bin/env python3
"""Проверка локальных ссылок по всем HTML сайта.

Идёт по каждому .html/.htm, находит href/src на локальные файлы
(css/js/картинки/pdf/md/html) и проверяет, что файл существует.
Внешние URL, якоря, mailto и hash-роуты блога (blog/#/...) пропускаются.

Выход: код 0 — битых нет; код 1 — список битых ссылок в stdout.
Запуск из корня репозитория: python3 scripts/check_links.py
"""
import os
import re
import sys
import glob

EXTS = ('.css', '.js', '.png', '.svg', '.jpg', '.jpeg', '.gif',
        '.pdf', '.webp', '.ico', '.md', '.htm', '.html')
SKIP_PREFIXES = ('http://', 'https://', '#', 'mailto:', '//', 'data:', 'blog/#', './')
ATTR_RE = re.compile(r'(?:href|src)\s*=\s*"([^"]+)"')


def main() -> int:
    missing = []
    checked = 0
    pages = glob.glob('**/*.html', recursive=True) + glob.glob('**/*.htm', recursive=True)
    for html in pages:
        if html.startswith(('node_modules/', '.git/')):
            continue
        base = os.path.dirname(html)
        content = open(html, encoding='utf-8', errors='ignore').read()
        for ref in ATTR_RE.findall(content):
            if ref.startswith(SKIP_PREFIXES):
                continue
            path = ref.split('?')[0].split('#')[0]
            if not path or not path.lower().endswith(EXTS):
                continue
            resolved = os.path.normpath(os.path.join(base, path))
            checked += 1
            if not os.path.exists(resolved):
                missing.append(f"{html}: '{ref}'")
    print(f'checked {checked} local refs in {len(pages)} pages')
    if missing:
        print(f'BROKEN ({len(missing)}):')
        print('\n'.join(missing))
        return 1
    print('OK: no broken links')
    return 0


if __name__ == '__main__':
    sys.exit(main())
