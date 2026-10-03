#!/usr/bin/env python3
"""Firebase servis akkauntini tekshiradi (DEPLOY.md 6.3 va 6.4).

    scripts/firebase-check.py <servis-akkaunt.json>
    scripts/firebase-check.py --env FCM_SERVICE_ACCOUNT_PRODUCTION
    scripts/firebase-check.py --env FIREBASE_APPDIST_SA_STAGING --app <app-id>

Ikki tekshiruv:
  1. **FCM** — Edge Function (`notify-dispatch`) bilan bir xil yo'l: RS256 JWT
     → access token → `messages:send`. Xabar yuborilmaydi (`validate_only` va
     ataylab yaroqsiz qurilma tokeni), kutilgan javob — "token yaroqsiz".
  2. **App Distribution** (`--app` berilsa) — relizlar ro'yxatini o'qiydi.
     CI yuklashi uchun shu huquq kerak; `firebase appdistribution:*` buyrug'i
     bilan tekshirib bo'lmaydi — CLI o'z login sessiyasini afzal ko'radi.

Ruxsat yo'q bo'lsa 403 va chiqish kodi 1. Kalit chiqishga chiqarilmaydi.
"""

import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

TOKEN_URL = 'https://oauth2.googleapis.com/token'
SCOPE = 'https://www.googleapis.com/auth/cloud-platform'
JWT_TTL_SECONDS = 300
ENV_FILE = '.env.deploy'


def b64url(raw: bytes) -> bytes:
    return base64.urlsafe_b64encode(raw).rstrip(b'=')


def post(url: str, data: bytes, headers: dict[str, str]) -> tuple[int, dict]:
    request = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        body = error.read().decode()
        try:
            return error.code, json.loads(body)
        except json.JSONDecodeError:
            return error.code, {'raw': body[:200]}


def sign(private_key: str, payload: bytes) -> bytes:
    """RS256 imzo — kalit faqat vaqtinchalik faylda (0600), so'ng o'chadi."""
    with tempfile.TemporaryDirectory() as directory:
        path = os.path.join(directory, 'key.pem')
        with open(path, 'w', opener=lambda p, f: os.open(p, f, 0o600)) as handle:
            handle.write(private_key)
        return subprocess.run(
            ['openssl', 'dgst', '-sha256', '-sign', path],
            input=payload, capture_output=True, check=True,
        ).stdout


def access_token(account: dict) -> str:
    now = int(time.time())
    claims = {
        'iss': account['client_email'],
        'scope': SCOPE,
        'aud': TOKEN_URL,
        'iat': now,
        'exp': now + JWT_TTL_SECONDS,
    }
    signing_input = b'.'.join(
        b64url(json.dumps(value).encode())
        for value in ({'alg': 'RS256', 'typ': 'JWT'}, claims)
    )
    jwt = signing_input + b'.' + b64url(sign(account['private_key'], signing_input))
    status, body = post(
        TOKEN_URL,
        b'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt,
        {'content-type': 'application/x-www-form-urlencoded'},
    )
    if status != 200:
        raise SystemExit(f"  ❌ access token olinmadi: {body.get('error_description') or body}")
    return body['access_token']


def load_account(argument: str, from_env: bool) -> dict:
    if not from_env:
        return json.loads(open(argument, encoding='utf-8').read())
    for line in open(ENV_FILE, encoding='utf-8'):
        name, _, value = line.strip().partition('=')
        if name == argument and value:
            return json.loads(base64.b64decode(value))
    raise SystemExit(f'  ❌ {ENV_FILE} da {argument} topilmadi yoki bo\'sh')


def app_distribution(token: str, project_number: str, app_id: str) -> int:
    """Relizlarni o'qish — yuklash uchun kerak bo'lgan huquqni ko'rsatadi."""
    url = (
        f'https://firebaseappdistribution.googleapis.com/v1/projects/'
        f'{project_number}/apps/{app_id}/releases'
    )
    request = urllib.request.Request(url, headers={'authorization': f'Bearer {token}'})
    try:
        with urllib.request.urlopen(request, timeout=20):
            print('  App Distribution: ✅ ruxsat bor')
            return 0
    except urllib.error.HTTPError as error:
        if error.code == 403:
            print(
                '  App Distribution: ❌ ruxsat yo\'q — servis akkauntga '
                '"Firebase App Distribution Admin" rolini bering (DEPLOY.md 6.4)'
            )
        else:
            print(f'  App Distribution: ⚠️  HTTP {error.code}')
        return 1


def main(argv: list[str]) -> int:
    from_env = '--env' in argv
    app_id = ''
    if '--app' in argv:
        index = argv.index('--app')
        app_id = argv[index + 1] if index + 1 < len(argv) else ''
        argv = argv[:index] + argv[index + 2:]
    rest = [a for a in argv if a != '--env']
    if len(rest) != 1:
        print(__doc__)
        return 2
    account = load_account(rest[0], from_env)
    for field in ('project_id', 'client_email', 'private_key'):
        if not account.get(field):
            print(f'  ❌ servis akkauntda {field} yo\'q')
            return 1

    print(f"  loyiha: {account['project_id']}")
    token = access_token(account)
    print('  access token: ✅')

    if app_id:
        # `1:473207003953:android:...` — o'rtadagi qism loyiha raqami.
        return app_distribution(token, app_id.split(':')[1], app_id)

    status, result = post(
        f"https://fcm.googleapis.com/v1/projects/{account['project_id']}/messages:send",
        json.dumps({
            'validate_only': True,
            'message': {
                'token': 'TEKSHIRUV-UCHUN-YAROQSIZ-TOKEN',
                'notification': {'title': 'test', 'body': 'test'},
            },
        }).encode(),
        {'authorization': f'Bearer {token}', 'content-type': 'application/json'},
    )
    error = result.get('error') or {}
    message = error.get('message', '')
    code = (error.get('details') or [{}])[0].get('errorCode', '')
    if status == 400 and ('registration token' in message or code == 'INVALID_ARGUMENT'):
        print('  messages:send: ✅ ruxsat bor (sinov tokeni yaroqsiz — kutilgan javob)')
        return 0
    if status == 403:
        print(f'  messages:send: ❌ ruxsat yo\'q yoki FCM API o\'chiq — {message[:120]}')
        return 1
    print(f'  messages:send: ⚠️  HTTP {status} — {message[:120] or result}')
    return 1


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
