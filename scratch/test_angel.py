import os
import json
import urllib.request
import hmac
import hashlib
import time
import base64

def generate_totp(secret):
    key = base64.b32decode(secret.upper() + '=' * (-len(secret) % 8))
    t = int(time.time() // 30)
    msg = t.to_bytes(8, 'big')
    h = hmac.new(key, msg, hashlib.sha1).digest()
    o = h[-1] & 0x0f
    code = (int.from_bytes(h[o:o+4], 'big') & 0x7fffffff) % 1000000
    return f"{code:06d}"

apiKey = "4DBv6HvT"
clientCode = "N89824"
password = "9691"
totpSecret = "AV7KF7BEJBOOCVIS53TZZB2VEU"

totp = generate_totp(totpSecret)
print(f"Generated TOTP: {totp}")

url = "https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword"
headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "192.168.1.1",
    "X-ClientPublicIP": "106.200.1.1",
    "X-MACAddress": "fe80::100:7f:fffe",
    "X-PrivateKey": apiKey
}

payload = {
    "clientcode": clientCode,
    "password": password,
    "totp": totp
}

req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
try:
    with urllib.request.urlopen(req) as response:
        res_body = response.read().decode('utf-8')
        print("Response Body:", res_body)
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code, e.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
