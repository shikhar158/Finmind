// ============================================================
// market.js — Backend Delegation for Market Data
// ============================================================

const MarketData = (() => {
  const ASSET_MAP = {
    gold:     { symbol: 'XAU', type: 'commodity', name: 'Gold' },
    silver:   { symbol: 'XAG', type: 'commodity', name: 'Silver' },
    bitcoin:  { symbol: 'BTC', type: 'crypto',    name: 'Bitcoin' },
    btc:      { symbol: 'BTC', type: 'crypto',    name: 'Bitcoin' },
    ethereum: { symbol: 'ETH', type: 'crypto',    name: 'Ethereum' },
    eth:      { symbol: 'ETH', type: 'crypto',    name: 'Ethereum' },
    nifty:    { symbol: 'NSEI', type: 'index',    name: 'Nifty 50' },
    sensex:   { symbol: 'BSESN', type: 'index',   name: 'Sensex' },
    apple:    { symbol: 'AAPL', type: 'stock',    name: 'Apple' },
    aapl:     { symbol: 'AAPL', type: 'stock',    name: 'Apple' },
    tesla:    { symbol: 'TSLA', type: 'stock',    name: 'Tesla' },
    tsla:     { symbol: 'TSLA', type: 'stock',    name: 'Tesla' },
    google:   { symbol: 'GOOGL', type: 'stock',   name: 'Google' },
    microsoft:{ symbol: 'MSFT', type: 'stock',    name: 'Microsoft' },
    infosys:  { symbol: 'INFY', type: 'stock',    name: 'Infosys' },
    infy:     { symbol: 'INFY', type: 'stock',    name: 'Infosys' },
    hdfc:     { symbol: 'HDFCBANK.BSE', type: 'stock', name: 'HDFC Bank' },
    reliance: { symbol: 'RELIANCE.BSE', type: 'stock', name: 'Reliance' },
    real_estate: { symbol: 'VNQ', type: 'stock', name: 'Real Estate ETF' },
  };

  function extractAsset(text) {
    const t = text.toLowerCase();
    for (const [keyword, meta] of Object.entries(ASSET_MAP)) {
      if (t.includes(keyword)) return meta;
    }
    return null;
  }

  async function getMarketContext(userMessage, country = null, holdings = []) {
    try {
      const res = await fetch('/api/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, country, holdings })
      });
      const data = await res.json();
      if (data.success) {
        return { asset: data.asset, news: data.news || [], price: data.price || null };
      }
      throw new Error(data.error || 'Market fetch failed');
    } catch (err) {
      console.error('Market lookup error:', err);
      return { asset: null, news: [], price: null };
    }
  }

  return { getMarketContext, extractAsset };
})();
