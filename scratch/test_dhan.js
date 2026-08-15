const clientId = '1113019677';
const accessToken = process.env.DHAN_ACCESS_TOKEN || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzg2NjE4NTQ5LCJpYXQiOjE3ODY1MzIxNDksInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTEzMDE5Njc3In0.nRFtcHpQeWp9Flmrdn3tr-XxlGXTkbWnE_nLS7jdBaxTmkuenRwKbLEmMD7AZP2gms5Auq1LTrt4O92CbVVp_g';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function testDhan() {
  console.log('Testing Dhan REST Market Feed API with throttled calls...\n');
  
  const ltpUrl = 'https://api.dhan.co/v2/marketfeed/ltp';
  const quoteUrl = 'https://api.dhan.co/v2/marketfeed/quote';

  // 1. Test Equity LTP
  console.log('--- 1. Testing Equity Stocks LTP ---');
  const res1 = await fetch(ltpUrl, {
    method: 'POST',
    headers: { 'access-token': accessToken, 'client-id': clientId, 'Content-Type': 'application/json' },
    body: JSON.stringify({ "NSE_EQ": [2885, 11536, 1594, 1333] })
  });
  console.log('Status:', res1.status);
  console.log('Data:', await res1.text());

  await sleep(1500);

  // 2. Test Index LTP
  console.log('\n--- 2. Testing Index (NIFTY / BANKNIFTY) Quote ---');
  const res2 = await fetch(quoteUrl, {
    method: 'POST',
    headers: { 'access-token': accessToken, 'client-id': clientId, 'Content-Type': 'application/json' },
    body: JSON.stringify({ "NSE_INDEX": [13, 25] })
  });
  console.log('Status:', res2.status);
  console.log('Data:', await res2.text());
}

testDhan();
