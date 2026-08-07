const { query } = require('../server/dist/db/pool');

async function check() {
  try {
    const rows = await query(
      `SELECT instrument_token, trading_symbol, name, symbol, strike, option_type, expiry, exchange, lot_size
       FROM instruments
       WHERE (name ILIKE $1 OR symbol ILIKE $1 OR exchange = $2) AND active = TRUE
       LIMIT 40`,
      ['%CRUDE%', 'MCX']
    );
    console.log('Found instruments count:', rows.length);
    console.log(JSON.stringify(rows.slice(0, 10), null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

check();
