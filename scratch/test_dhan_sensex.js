const accessToken = process.env.DHAN_ACCESS_TOKEN || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzg2NjE4NTQ5LCJpYXQiOjE3ODY1MzIxNDksInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTEzMDE5Njc3In0.nRFtcHpQeWp9Flmrdn3tr-XxlGXTkbWnE_nLS7jdBaxTmkuenRwKbLEmMD7AZP2gms5Auq1LTrt4O92CbVVp_g';
const clientId = process.env.DHAN_CLIENT_ID || '1113019677';

async function testSensexOptionChain() {
  console.log('--- TESTING DHAN OPTION CHAIN FOR SENSEX (UnderlyingScrip: 51) ---');
  // Dhan option chain expiries
  const expiries = ['2026-08-13', '2026-08-20', '2026-08-27', '2026-08-14'];
  
  for (const exp of expiries) {
    try {
      await new Promise(r => setTimeout(r, 1200)); // Rate limit pause
      const res = await fetch('https://api.dhan.co/v2/optionchain', {
        method: 'POST',
        headers: {
          'access-token': accessToken,
          'client-id': clientId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          UnderlyingScrip: 51,
          UnderlyingSeg: 'IDX_I',
          Expiry: exp
        })
      });
      const json = await res.json();
      console.log(`Expiry [${exp}] Status:`, res.status, json.status);
      if (json.status === 'success' && json.data) {
        console.log(`  Spot Price: ${json.data.last_price || json.data.spot_price}`);
        console.log(`  Strikes count: ${json.data.oc ? Object.keys(json.data.oc).length : 0}`);
        const strikes = Object.keys(json.data.oc || {});
        if (strikes.length > 0) {
          console.log(`  Sample strike ${strikes[0]}:`, JSON.stringify(json.data.oc[strikes[0]]));
        }
      } else {
        console.log(`  Message:`, JSON.stringify(json).slice(0, 150));
      }
    } catch (err) {
      console.error(`Error for ${exp}:`, err.message);
    }
  }
}

testSensexOptionChain();
