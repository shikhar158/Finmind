import Parser from 'rss-parser';

const parser = new Parser();

const EXPERT_FEEDS = [
  { name: 'WSJ Markets', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml' },
  { name: 'Ray Dalio', url: 'https://raydalio.substack.com/feed' },
  { name: 'Financial Times', url: 'https://www.ft.com/?format=rss' },
  { name: 'CNBC Finance', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html' },
  { name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' }
];

const ASSET_MAP = {
  gold:     { symbol: 'GC=F', type: 'commodity', name: 'Gold' },
  silver:   { symbol: 'SI=F', type: 'commodity', name: 'Silver' },
  bitcoin:  { symbol: 'BTC-USD', type: 'crypto',    name: 'Bitcoin' },
  btc:      { symbol: 'BTC-USD', type: 'crypto',    name: 'Bitcoin' },
  ethereum: { symbol: 'ETH-USD', type: 'crypto',    name: 'Ethereum' },
  eth:      { symbol: 'ETH-USD', type: 'crypto',    name: 'Ethereum' },
  nifty:    { symbol: '^NSEI', type: 'index',    name: 'Nifty 50' },
  sensex:   { symbol: '^BSESN', type: 'index',   name: 'Sensex' },
  apple:    { symbol: 'AAPL', type: 'stock',    name: 'Apple' },
  aapl:     { symbol: 'AAPL', type: 'stock',    name: 'Apple' },
  tesla:    { symbol: 'TSLA', type: 'stock',    name: 'Tesla' },
  tsla:     { symbol: 'TSLA', type: 'stock',    name: 'Tesla' },
  google:   { symbol: 'GOOG', type: 'stock',   name: 'Google' },
  microsoft:{ symbol: 'MSFT', type: 'stock',    name: 'Microsoft' },
  infosys:  { symbol: 'INFY', type: 'stock',    name: 'Infosys' },
  infy:     { symbol: 'INFY', type: 'stock',    name: 'Infosys' },
  hdfc:     { symbol: 'HDFCBANK.NS', type: 'stock', name: 'HDFC Bank' },
  reliance: { symbol: 'RELIANCE.NS', type: 'stock', name: 'Reliance' },
  real_estate: { symbol: 'VNQ', type: 'stock', name: 'Real Estate ETF' }
};

function extractAsset(text) {
  const t = text.toLowerCase();
  for (const [keyword, meta] of Object.entries(ASSET_MAP)) {
    if (t.includes(keyword)) return meta;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { message, country = null, holdings = [] } = req.body;
  if (!message) return res.status(400).json({ success: false, error: 'message input is required' });

  const newsKey = process.env.NEWS_API_KEY;
  const avKey = process.env.AV_API_KEY;

  const asset = extractAsset(message);
  let query = asset ? asset.name : message.slice(0, 40);

  // Fallback 1: Use Holdings if no asset explicitly extracted
  if (!asset && Array.isArray(holdings) && holdings.length > 0) {
    const holdingNames = holdings.map(h => typeof h === 'string' ? h : h.asset || h.name).filter(Boolean).slice(0, 3);
    if (holdingNames.length > 0) {
      query = holdingNames.join(' OR ');
    }
  }

  // Fallback 2: Append Country filter to search context
  let queryWithCountry = query;
  if (country && country !== 'Global') {
    const countryNames = { IN: 'India', US: 'USA', GB: 'UK' };
    const countryName = countryNames[country.toUpperCase()] || country;
    queryWithCountry = `(${query}) AND ("${countryName}")`;
  }

  const fetchNews = async () => {
    const gnewsKey = process.env.GNEWS_KEY; // Removed NEWS_API_KEY fallback to avoid 401s
    let gnewsArticles = [];
    
    // Append strict financial context filters Node setups
    const queryWithFinance = `(${queryWithCountry}) AND (finance OR business OR stocks OR market OR economy)`;

    if (gnewsKey) {
      try {
        const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(queryWithFinance)}&lang=en&max=3&apikey=${gnewsKey}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.articles) {
          gnewsArticles = data.articles.map(a => ({
            title: a.title,
            source: a.source?.name || 'GNews',
            url: a.url,
            publishedAt: a.publishedAt?.slice(0, 10)
          }));
        }
      } catch (e) {
        console.warn('GNews error:', e.message);
      }
    }

    let expertArticles = [];
    try {
      const fetchExpertFeed = async (feed) => {
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 3500)
          );
          const feedData = await Promise.race([
            parser.parseURL(feed.url),
            timeoutPromise
          ]);
          return (feedData.items || []).slice(0, 2).map(item => ({
            title: item.title?.trim() || '',
            source: feed.name,
            url: item.link?.trim() || '',
            publishedAt: item.pubDate?.slice(0, 16) || ''
          }));
        } catch (e) {
          console.warn(`Feed error/timeout for ${feed.name}:`, e.message);
          return [];
        }
      };
      
      const results = await Promise.all(EXPERT_FEEDS.map(fetchExpertFeed));
      expertArticles = results.flat();

      if (query) {
        const q = query.toLowerCase().split(' ');
        const relevant = expertArticles.filter(item => 
          q.some(word => item.title.toLowerCase().includes(word))
        );
        expertArticles = relevant.length ? relevant : expertArticles; // Fallback to general list Node setups
      }
    } catch (e) {
      console.warn('Expert feed error:', e.message);
    }

    const allNews = [...gnewsArticles, ...expertArticles];
    return allNews.slice(0, 5);
  };

  const fetchPrice = async () => {
    if (!asset) return null;
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${asset.symbol}`;
      const response = await fetch(url);
      const data = await response.json();
      
      const meta = data.chart?.result?.[0]?.meta;
      if (!meta || meta.regularMarketPrice === undefined) return null;

      const currentPrice = meta.regularMarketPrice;
      const previousClose = meta.chartPreviousClose;
      let changePercent = null;
      if (previousClose) {
        changePercent = (((currentPrice - previousClose) / previousClose) * 100).toFixed(2);
      }

      return {
        asset: asset.name,
        symbol: asset.symbol,
        price: currentPrice.toFixed(2),
        change: changePercent,
        currency: meta.currency || 'USD',
      };
    } catch (e) {
      console.warn('Yahoo Finance backend error:', e.message);
      return null;
    }
  };

  const [news, price] = await Promise.all([
    fetchNews(),
    fetchPrice(),
  ]);

  return res.json({ success: true, asset, news, price });
}
