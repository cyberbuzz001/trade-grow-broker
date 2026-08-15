const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function testImporter() {
  const csvPath = path.resolve(__dirname, '../data/api-scrip-master.csv');
  console.log('Testing Dhan Scrip Master importer from:', csvPath);
  const start = Date.now();

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const tokenLookupMap = new Map(); // key -> { securityId, segment, tradingSymbol, symbol, strike, optionType, expiry, lotSize }
  let isHeader = true;
  let count = 0;

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }
    if (!line || line.trim() === '') continue;

    // SEM_EXM_EXCH_ID,SEM_SEGMENT,SEM_SMST_SECURITY_ID,SEM_INSTRUMENT_NAME,SEM_EXPIRY_CODE,SEM_TRADING_SYMBOL,SEM_LOT_UNITS,SEM_CUSTOM_SYMBOL,SEM_EXPIRY_DATE,SEM_STRIKE_PRICE,SEM_OPTION_TYPE,SEM_TICK_SIZE,SEM_EXPIRY_FLAG,SEM_EXCH_INSTRUMENT_TYPE,SEM_SERIES,SM_SYMBOL_NAME
    const parts = line.split(',');
    if (parts.length < 11) continue;

    const exchange = parts[0]?.trim();
    const segment = parts[1]?.trim(); // D = F&O, E = EQ, I = Index
    const securityId = parts[2]?.trim();
    const instrumentName = parts[3]?.trim();
    const tradingSymbol = parts[5]?.trim();
    const lotSize = parseFloat(parts[6] || '1');
    const expiryDateStr = parts[8]?.trim(); // e.g. 2026-09-29 14:30:00 or 2026-09-29
    const strikePrice = parseFloat(parts[9] || '0');
    const optionType = parts[10]?.trim(); // CE, PE, XX
    const symbolName = parts[15]?.trim() || tradingSymbol.split('-')[0];

    if (!securityId) continue;
    count++;

    const expiryDate = expiryDateStr ? expiryDateStr.split(' ')[0] : '';
    const rec = {
      securityId,
      exchange,
      segment: segment === 'D' ? (exchange === 'BSE' ? 'BSE_FNO' : 'NSE_FNO') : segment === 'I' ? (exchange === 'BSE' ? 'IDX_I' : 'NSE_INDEX') : (exchange === 'BSE' ? 'BSE_EQ' : 'NSE_EQ'),
      tradingSymbol,
      symbolName,
      strikePrice,
      optionType,
      expiryDate,
      lotSize
    };

    // 1. Direct securityId key
    tokenLookupMap.set(securityId, rec);

    // 2. Canonical token key e.g. NFO_35000 or BFO_35000
    const segPrefix = rec.segment.startsWith('BSE') ? 'BFO' : 'NFO';
    tokenLookupMap.set(`${segPrefix}_${securityId}`, rec);

    // 3. Option strike lookup key: e.g. NFO_NIFTY_24500_CE or NFO_BANKNIFTY_72600_CE
    if ((optionType === 'CE' || optionType === 'PE') && strikePrice > 0 && symbolName) {
      const cleanSym = symbolName.toUpperCase().replace(/^(NSE_|BSE_)/, '');
      const optKey = `${segPrefix}_${cleanSym}_${strikePrice}_${optionType}`;
      tokenLookupMap.set(optKey, rec);
      
      // With expiry date key
      if (expiryDate) {
        tokenLookupMap.set(`${optKey}_${expiryDate}`, rec);
      }
    }
  }

  console.log(`Parsed ${count} Dhan instruments into ${tokenLookupMap.size} lookup keys in ${Date.now() - start}ms`);

  // Sample tests
  console.log('\n--- SAMPLE LOOKUPS ---');
  console.log('SecurityID 13 (NIFTY 50):', tokenLookupMap.get('13'));
  console.log('SecurityID 25 (BANKNIFTY):', tokenLookupMap.get('25'));
  console.log('SecurityID 51 (SENSEX):', tokenLookupMap.get('51'));
  console.log('Option key NFO_BANKNIFTY_72600_CE:', tokenLookupMap.get('NFO_BANKNIFTY_72600_CE'));
  console.log('Option key NFO_BANKNIFTY_72600_PE:', tokenLookupMap.get('NFO_BANKNIFTY_72600_PE'));
}

testImporter();
