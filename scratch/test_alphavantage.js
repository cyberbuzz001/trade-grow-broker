const apiKey = 'CC23XT2DVHARWKAU';

async function testAlphaVantage() {
  const symbols = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'BSESN', 'IBM'];

  console.log('--- Testing Alpha Vantage API with Key: ' + apiKey + ' ---');

  for (const sym of symbols) {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${apiKey}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      console.log(`\nSymbol: ${sym}`);
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(`Error fetching ${sym}:`, e.message);
    }
  }
}

testAlphaVantage();
