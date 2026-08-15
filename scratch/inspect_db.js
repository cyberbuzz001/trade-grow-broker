const { pool } = require('./server/dist/db/pool');

async function main() {
  const res = await pool.query('SELECT id, symbol, net_qty, buy_qty, sell_qty, buy_price, sell_price, average_price, realized_pnl FROM positions');
  console.log('--- POSITIONS ---');
  console.table(res.rows);

  const ords = await pool.query("SELECT id, order_id, symbol, side, order_type, quantity, price, status, rejection_reason FROM orders WHERE symbol LIKE '%24350%' ORDER BY created_at DESC LIMIT 10");
  console.log('--- ORDERS (NIFTY 24350 CE) ---');
  console.table(ords.rows);

  process.exit(0);
}

main().catch(console.error);
