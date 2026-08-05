require('dotenv').config();
const crypto = require('crypto');

function generateTOTP(secret) {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
  for (let i = 0; i < cleanSecret.length; i++) {
    const val = base32chars.indexOf(cleanSecret.charAt(i));
    if (val !== -1) {
      bits += val.toString(2).padStart(5, '0');
    }
  }

  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substring(i * 8, i * 8 + 8), 2);
  }

  const epoch = Math.floor(Date.now() / 1000);
  const time = Math.floor(epoch / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(time), 0);

  const hmac = crypto.createHmac('sha1', Buffer.from(bytes));
  hmac.update(buffer);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, '0');
}

async function testAngelOneLogin() {
  const apiKey = process.env.SMARTAPI_API_KEY || process.env.ANGELONE_API_KEY;
  const clientCode = process.env.SMARTAPI_CLIENT_CODE || process.env.ANGELONE_CLIENT_ID;
  const password = process.env.SMARTAPI_PASSWORD || process.env.ANGELONE_CLIENT_SECRET;
  const totpSecret = process.env.SMARTAPI_TOTP_SECRET || process.env.ANGELONE_TOTP_SECRET;

  console.log(`[AngelTest] ClientCode: ${clientCode}, ApiKey: ${apiKey}`);

  const totp = generateTOTP(totpSecret);
  console.log(`[AngelTest] Generated TOTP: ${totp}`);

  try {
    const res = await fetch('https://apiconnect.angelone.in/rest/secure/angelbroking/user/v1/loginByPassword', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB',
        'X-ClientLocalIP': '192.168.1.100',
        'X-ClientPublicIP': '106.200.1.100',
        'X-MACAddress': 'fe80::100:7f:fffe',
        'X-PrivateKey': apiKey
      },
      body: JSON.stringify({
        clientcode: clientCode,
        password: password,
        totp: totp
      })
    });

    console.log('[AngelTest] Response HTTP Status:', res.status);
    const text = await res.text();
    console.log('[AngelTest] Response Text Body:', text.slice(0, 300));
    const data = JSON.parse(text);
    if (data.data && data.data.jwtToken) {
      console.log('[AngelTest] JWT Token received successfully!');
      
      // Fetch Live Market Quote for RELIANCE (Token 2885) and NIFTY 50 (Token 99926000)
      const quoteRes = await fetch('https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Authorization': `Bearer ${data.data.jwtToken}`,
          'X-UserType': 'USER',
          'X-SourceID': 'WEB',
          'X-ClientLocalIP': '127.0.0.1',
          'X-ClientPublicIP': '127.0.0.1',
          'X-MACAddress': '12-34-56-78-90-AB',
          'X-PrivateKey': apiKey
        },
        body: JSON.stringify({
          mode: 'FULL',
          exchangeTokens: {
            NSE: ["2885", "99926000", "11536", "1594"]
          }
        })
      });
      const quoteData = await quoteRes.json();
      console.log('[AngelTest] Market Quote Response:', JSON.stringify(quoteData, null, 2));
    }
  } catch (err) {
    console.error('[AngelTest] Error:', err.message);
  }
}

testAngelOneLogin();
