import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { generateTOTP } from '../server/src/utils/totp';

async function testAngelOneLogin() {
  const apiKey = process.env.SMARTAPI_API_KEY || process.env.ANGELONE_API_KEY;
  const clientCode = process.env.SMARTAPI_CLIENT_CODE || process.env.ANGELONE_CLIENT_ID;
  const password = process.env.SMARTAPI_PASSWORD || process.env.ANGELONE_CLIENT_SECRET;
  const totpSecret = process.env.SMARTAPI_TOTP_SECRET || process.env.ANGELONE_TOTP_SECRET;

  console.log(`[AngelTest] ClientCode: ${clientCode}, ApiKey: ${apiKey}`);

  if (!totpSecret) {
    console.error('TOTP Secret missing');
    return;
  }

  const totp = generateTOTP(totpSecret);
  console.log(`[AngelTest] Generated TOTP: ${totp}`);

  try {
    const res = await fetch('https://apiconnect.angelbroking.com/rest/secure/angelbroking/user/v1/loginByPassword', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB',
        'X-ClientLocalIP': '127.0.0.1',
        'X-ClientPublicIP': '127.0.0.1',
        'X-MACAddress': '12-34-56-78-90-AB',
        'X-PrivateKey': apiKey || ''
      },
      body: JSON.stringify({
        clientcode: clientCode,
        password: password,
        totp: totp
      })
    });

    const data = await res.json();
    console.log('[AngelTest] Login Response:', JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error('[AngelTest] Error:', err.message);
  }
}

testAngelOneLogin();
