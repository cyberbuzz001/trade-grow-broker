export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface Wallet {
  userId: string;
  cashBalance: number;
  usedMargin: number;
  realizedPnl: number;
  unrealizedPnl: number;
  buyingPower: number;
}

export interface MarketTick {
  instrumentToken: string;
  exchange: string;
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
  bid: number;
  ask: number;
  bidQty: number;
  askQty: number;
  timestamp: number;
}

export interface Order {
  id: string;
  order_id: string;
  symbol: string;
  exchange: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  filled_quantity: number;
  price: number;
  average_price: number;
  order_type: 'MARKET' | 'LIMIT' | 'SL' | 'SL_M';
  product_type: 'MIS' | 'CNC' | 'NRML';
  status: string;
  rejection_reason?: string;
  created_at: string;
}

export interface Position {
  id: string;
  symbol: string;
  exchange: string;
  productType: string;
  buyQty: number;
  sellQty: number;
  netQty: number;
  averagePrice: number;
  ltp: number;
  realizedPnl: number;
  unrealizedPnl: number;
}

export interface Holding {
  id: string;
  symbol: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  ltp: number;
  currentValue: number;
  pnl: number;
  pnlPercentage: number;
}

export interface OptionContractDetails {
  instrumentToken: string;
  tradingSymbol?: string;
  ltp: number;
  bid?: number;
  ask?: number;
  change: number;
  volume: number;
  openInterest: number;
  openInterestChange?: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  classification?: 'ITM' | 'ATM' | 'OTM';
}

export interface OptionChainItem {
  strikePrice: number;
  expiry: string;
  isAtm?: boolean;
  ce: OptionContractDetails;
  pe: OptionContractDetails;
}
