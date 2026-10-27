"""DuckDNS IPv4 updater. Logs never include the account token or request URL."""
import os
from pathlib import Path
import re
import signal
import sys
import threading
import time
import urllib.parse
import urllib.request

SUCCESS = Path('/tmp/wordloom-duckdns-success')
INTERVAL = 300


def healthy():
    try:
        return 0 <= time.time() - float(SUCCESS.read_text()) < INTERVAL * 3
    except (OSError, ValueError):
        return False


def update(domain, token, opener=urllib.request.urlopen):
    query = urllib.parse.urlencode({'domains': domain, 'token': token, 'ip': ''})
    request = urllib.request.Request(
        'https://www.duckdns.org/update?' + query,
        headers={'User-Agent': 'Wordloom-DuckDNS/1.0'},
    )
    # DuckDNS detects the request's public IPv4 when ip is empty.
    with opener(request, timeout=20) as response:
        if response.read(256).decode('ascii').strip() != 'OK':
            raise ValueError('DuckDNS rejected update')
    SUCCESS.write_text(str(time.time()))


def main():
    if sys.argv[1:] == ['--check-health']:
        return 0 if healthy() else 1
    domain = os.environ.get('DUCKDNS_SUBDOMAIN', '').strip()
    token = os.environ.get('DUCKDNS_TOKEN', '').strip()
    if not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', domain) or not token:
        print('Set DUCKDNS_SUBDOMAIN (subdomain only) and DUCKDNS_TOKEN.', flush=True)
        return 1
    stopped = threading.Event()
    for signum in (signal.SIGTERM, signal.SIGINT):
        signal.signal(signum, lambda *_: stopped.set())
    while not stopped.is_set():
        try:
            update(domain, token)
            print('DuckDNS IPv4 update: OK', flush=True)
        except Exception as error:
            # Exception messages may contain the token-bearing URL; print only the type.
            print('DuckDNS IPv4 update failed (' + type(error).__name__ + '). Retrying in 5 minutes.', flush=True)
        stopped.wait(INTERVAL)
    return 0


if __name__ == '__main__':
    sys.exit(main())
