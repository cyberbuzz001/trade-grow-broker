const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { InstrumentMasterService } = require('../server/dist/marketData/InstrumentMasterService');
const { DhanAdapter } = require('../server/dist/marketData/DhanAdapter');
const { OptionChainEngine } = require('../server/dist/marketData/OptionChainEngine');

async function verifyFix() {
  console.log('=== VERIFYING DHAN SECURITY ID STREAMING FIX (DIST RUNTIME) ===\n');

  // 1. Initialize InstrumentMasterService
  console.log('--- 1. Initializing InstrumentMasterService & Syncing Dhan Scrip Master ---');
  const service = InstrumentMasterService.getInstance();
  await service.syncDhanScripMaster();

  const status = service.getHealthStatus();
  console.log('Service Health Status:', status);

  // 2. Test DhanAdapter Security Resolution
  console.log('\n--- 2. Testing DhanAdapter Security Resolution ---');
  const adapter = new DhanAdapter();

  const tokensToTest = [
    'NSE_NIFTY50',
    'NSE_BANKNIFTY',
    'BSE_SENSEX',
    'NFO_NIFTY_24500_CE',
    'NFO_BANKNIFTY_72600_CE',
    'NFO_BANKNIFTY_72600_PE'
  ];

  for (const t of tokensToTest) {
    const mapping = adapter.resolveSecurityMapping(t);
    console.log(`Token [${t}] -> Security Mapping:`, mapping);
  }

  // 3. Test Dhan Security ID to Token Reverse Mapping
  console.log('\n--- 3. Testing Dhan Security ID Reverse Token Resolution ---');
  const secIdsToTest = ['13', '25', '51', '41584', '41585'];

  for (const secId of secIdsToTest) {
    const token = service.findTokenBySecurityId(secId);
    console.log(`Security ID [${secId}] -> Resolved Token:`, token);
  }

  // 4. Test Option Chain Generation
  console.log('\n--- 4. Testing OptionChainEngine Matrix Generation ---');
  try {
    const chainRes = await OptionChainEngine.generateOptionChain({
      symbol: 'BANKNIFTY',
      strikeRange: '5'
    });
    console.log(`Option Chain generated for ${chainRes.underlying} | Spot: ${chainRes.spotPrice} | Total Strikes: ${chainRes.chain.length}`);
    if (chainRes.chain.length > 0) {
      const sample = chainRes.chain[0];
      console.log('Sample Strike Row:', {
        strikePrice: sample.strikePrice,
        ceToken: sample.ce?.instrumentToken,
        ceLtp: sample.ce?.ltp,
        peToken: sample.pe?.instrumentToken,
        peLtp: sample.pe?.ltp
      });
      const ceMapping = adapter.resolveSecurityMapping(sample.ce?.instrumentToken || '');
      console.log('Sample CE Dhan Security Mapping:', ceMapping);
    }
  } catch (err) {
    console.error('Option Chain generation error:', err);
  }

  console.log('\n=== VERIFICATION COMPLETE ===');
  process.exit(0);
}

verifyFix().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
