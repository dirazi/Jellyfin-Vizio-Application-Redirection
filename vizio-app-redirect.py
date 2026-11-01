#!/usr/bin/env python3
"""Local SmartCast app-state transition monitor. Python 3.9+, Linux."""
import argparse
import fcntl
import getpass
import ipaddress
import json
import os
from pathlib import Path
import ssl
import stat
import sys
import tempfile
import time
from collections import deque
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, HTTPSHandler, HTTPRedirectHandler, ProxyHandler, build_opener

STATE = Path('/var/lib/vizio-app-redirect')
TOKEN = STATE / 'auth-token'
KEYS = ('APP_ID', 'NAME_SPACE', 'MESSAGE')


def app(value, webfront=False):
    if not isinstance(value, dict) or set(value) != set(KEYS):
        raise ValueError('App config must contain exactly APP_ID, NAME_SPACE, MESSAGE')
    if not isinstance(value['APP_ID'], str) or type(value['NAME_SPACE']) is not int:
        raise ValueError('APP_ID must be a string; NAME_SPACE must be an integer')
    if not isinstance(value['MESSAGE'], str) and not (value['MESSAGE'] is None and not webfront):
        raise ValueError('Source MESSAGE must be a string or null; destination must be a string')
    return value


def triple(value):
    return tuple(value.get(k) for k in KEYS)


def private_dir():
    STATE.mkdir(mode=0o700, exist_ok=True)
    st = STATE.lstat()
    if not stat.S_ISDIR(st.st_mode) or st.st_uid != 0 or st.st_mode & 0o077:
        raise ValueError('State directory must be a real root-owned directory, mode 700')


def token_read():
    fd = os.open(TOKEN, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'r') as source:
        st = os.fstat(source.fileno())
        if not stat.S_ISREG(st.st_mode) or st.st_uid != 0 or st.st_nlink != 1 or st.st_mode & 0o077:
            raise ValueError('Token must be a root-owned regular file, mode 600, one link')
        token = source.read(4097).strip()
        if not token or len(token) > 4096:
            raise ValueError('Invalid token file')
        return token


class AuthError(Exception):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward the AUTH header to another origin.


class TV:
    def __init__(self, host, port):
        address = ipaddress.ip_address(host)  # Literal IP only; no supplied URL/path.
        netloc = '[' + str(address) + ']' if address.version == 6 else str(address)
        self.base = f'https://{netloc}:{port}'
        # Self-signed SmartCast certificate exception is confined to this client.
        self.client = build_opener(ProxyHandler({}), NoRedirect(),
                                   HTTPSHandler(context=ssl._create_unverified_context()))

    def request(self, path, payload=None, token=None):
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['AUTH'] = token
        data = json.dumps(payload).encode() if payload is not None else None
        req = Request(self.base + path, data=data, headers=headers,
                      method='PUT' if data is not None else 'GET')
        try:
            with self.client.open(req, timeout=5) as response:
                result = json.loads(response.read(262145))
        except HTTPError as exc:
            if exc.code in (401, 403):
                raise AuthError('Pairing token rejected; stop monitor and run pair') from None
            raise RuntimeError(f'TV HTTP {exc.code}') from None
        except (URLError, OSError, ValueError):
            raise RuntimeError('TV unavailable or invalid response') from None
        status = result.get('STATUS', {})
        if str(status.get('RESULT', '')).upper() != 'SUCCESS':
            if any(word in str(status).upper() for word in ('AUTH', 'PAIR')):
                raise AuthError('TV requires pairing again')
            raise RuntimeError('TV API did not report SUCCESS')
        return result

    def current(self, token):
        return triple(self.request('/app/current', token=token)['ITEM']['VALUE'])


def pair(tv):
    identity = {'DEVICE_ID': 'vizio-app-redirect-v1', 'DEVICE_NAME': 'Webfront Redirect'}
    challenge = tv.request('/pairing/start', identity)['ITEM']
    result = tv.request('/pairing/pair', dict(identity,
        CHALLENGE_TYPE=challenge['CHALLENGE_TYPE'],
        PAIRING_REQ_TOKEN=challenge['PAIRING_REQ_TOKEN'],
        RESPONSE_VALUE=getpass.getpass('New PIN displayed on TV: ').strip()))
    token = result['ITEM']['AUTH_TOKEN']
    fd, name = tempfile.mkstemp(prefix='.token-', dir=STATE)
    try:
        with os.fdopen(fd, 'w') as out:
            out.write(token + '\n')
        os.replace(name, TOKEN)
    finally:
        Path(name).unlink(missing_ok=True)
    print('Paired. Token stored privately; not printed.')


def monitor(tv, token, config, live):
    previous, last_error = None, False
    launches = deque()
    last_launch = float('-inf')
    target = triple(config['trigger'])
    print('LIVE' if live else 'OBSERVE', 'monitor; Ctrl-C stops.', flush=True)
    while True:
        try:
            state = tv.current(token)
        except (RuntimeError, KeyError, TypeError, AttributeError):
            if not last_error:
                print('Read failed; waiting for new baseline.', flush=True)
            previous, last_error = None, True
            time.sleep(2)
            continue
        last_error = False
        if previous is None:
            print('Baseline established; no launch.', flush=True)
        elif state != previous:
            print('App state changed.', flush=True)
            if state == target:
                now = time.monotonic()
                if not live:
                    print('Would launch configured webfront.', flush=True)
                elif now - last_launch < 8:
                    print('Suppressed by 8-second cooldown.', flush=True)
                else:
                    while launches and now - launches[0] > 60:
                        launches.popleft()
                    if len(launches) >= 3:
                        print('Safety stop: launch limit reached.', flush=True)
                        return
                    launches.append(now)
                    last_launch = now
                    tv.request('/app/launch', {'VALUE': config['launch']}, token)
                    print('Launch accepted; check TV.', flush=True)
        previous = state
        time.sleep(0.5)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('pair', 'capture', 'launch-once', 'observe', 'run'))
    parser.add_argument('--config', default='/etc/vizio-app-redirect.json')
    args = parser.parse_args()
    try:
        if os.geteuid() != 0:
            raise ValueError('Run as root; local state is root-only')
        os.umask(0o077)
        config = json.loads(Path(args.config).read_text())
        app(config['trigger'])
        app(config['launch'], webfront=True)
        if config['trigger'] == config['launch']:
            raise ValueError('Trigger and destination must differ')
        url = urlsplit(config['launch']['MESSAGE'])
        if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password:
            raise ValueError('Launch MESSAGE must be an HTTP(S) URL without credentials')
        port = config.get('tv_port', 7345)
        if type(port) is not int or not 1 <= port <= 65535:
            raise ValueError('Invalid TV port')
        tv = TV(config['tv_host'], port)
        private_dir()
        # All modes share a lock, so pairing cannot race a monitor.
        with open(STATE / 'process.lock', 'a') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise ValueError('Another redirect process is running; stop it first') from None
            if args.mode == 'pair':
                pair(tv)
            else:
                token = token_read()
                if args.mode == 'capture':
                    print(json.dumps(dict(zip(KEYS, tv.current(token))), indent=2))
                elif args.mode == 'launch-once':
                    tv.request('/app/launch', {'VALUE': config['launch']}, token)
                    print('Launch accepted. Confirm the webfront visually on TV.')
                else:
                    monitor(tv, token, config, args.mode == 'run')
        return 0
    except KeyboardInterrupt:
        print('Stopped.')
        return 0
    except AuthError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    except (ValueError, OSError, RuntimeError, KeyError, TypeError, AttributeError):
        print('Configuration, state or TV request failed. Check local setup; do not publish secrets.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
