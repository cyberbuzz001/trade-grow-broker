const path = require('path');
const { OptionChainEngine } = require(path.resolve(__dirname, '../server/dist/marketData/OptionChainEngine'));

async function testSensexEngine() {
  console.log('--- TESTING SENSEX OPTION CHAIN GENERATION VIA OPTIONCHAINENGINE ---');
  try {
    const res = await OptionChainEngine.generateOptionChain({ symbol: 'SENSEX' });
    console.log('Underlying:', res.underlying);
    console.log('Exchange:', res.exchange);
    console.log('Spot Price:', res.spotPrice);
    console.log('Futures Price:', res.futuresPrice);
    console.log('ATM Strike:', res.atmStrike);
    console.log('Expiry:', res.expiry);
    console.log('Chain Contracts Count:', res.chain.length);
    if (res.chain.length > 0) {
      const atmIndex = res.chain.findIndex(item => item.isAtm);
      console.log('ATM Contract Sample:', JSON.stringify(res.chain[atmIndex >= 0 ? atmIndex : 0], null, 2));
    }
  } catch (err) {
    console.error('Engine error:', err.stack);
  }
}

testSensexEngine();
