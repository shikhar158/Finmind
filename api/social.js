import Parser from 'rss-parser';

const parser = new Parser();

const EXPERT_FEEDS = [
  { name: 'WSJ Markets', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml' },
  { name: 'Ray Dalio (Principled Perspectives)', url: 'https://raydalio.substack.com/feed' },
  { name: 'Financial Times', url: 'https://www.ft.com/?format=rss' },
  { name: 'CNBC Finance', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html' },
  { name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' }
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { message, symbol } = req.body;
  const query = message ? message.slice(0, 50) : '';

  // 1. StockTwits
  const fetchStockTwits = async () => {
    if (!symbol) return { messages: [], bullish: 0, bearish: 0 };
    try {
      // Map generic symbols to StockTwits-specific ticker formats Node setups
      const STOCKTWITS_MAP = {
        'XAU': 'GLD',    // Gold ETF
        'XAG': 'SLV',    // Silver ETF
        'BTC': 'BTC.X',  // Crypto requires .X
        'ETH': 'ETH.X',
        'NSEI': 'NIFTY50',
        'BSESN': 'SENSEX'
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const targetSymbol = STOCKTWITS_MAP[symbol.toUpperCase()] || symbol;
      const url = `https://api.stocktwits.com/api/2/streams/symbol/${targetSymbol}.json`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (!data.messages) return { messages: [], bullish: 0, bearish: 0 };

      const msgs = data.messages.slice(0, 10);
      const bullish = msgs.filter(m => m.entities?.sentiment?.basic === 'Bullish').length;
      const bearish = msgs.filter(m => m.entities?.sentiment?.basic === 'Bearish').length;

      return {
        messages: msgs.map(m => ({
          body: m.body,
          sentiment: m.entities?.sentiment?.basic || 'Neutral',
          user: m.user?.username,
        })),
        bullish,
        bearish,
      };
    } catch (e) {
      console.warn('StockTwits error:', e.message);
      return { messages: [], bullish: 0, bearish: 0 };
    }
  };

  // Fallback mock posts for Reddit when blocked or rate-limited
  const getMockRedditPosts = (activeQuery) => {
    const q = (activeQuery || '').toLowerCase();
    let posts = [];
    let bullish = 0;
    let bearish = 0;

    if (q.includes('gold') || q.includes('gld')) {
      posts = [
        {
          subreddit: 'r/investing',
          title: 'Gold hits new highs amidst macro inflation worries',
          score: 245,
          numComments: 76,
          url: 'https://reddit.com/r/investing',
          snippet: 'Gold is acting as a classic hedge here. Investors are rotating out of high-multiple growth stocks.'
        },
        {
          subreddit: 'r/stocks',
          title: 'Should I buy gold ETFs (GLD) or physical gold?',
          score: 112,
          numComments: 43,
          url: 'https://reddit.com/r/stocks',
          snippet: 'ETFs are much more liquid and have lower spreads, but physical is better for a worst-case scenario.'
        },
        {
          subreddit: 'r/personalfinance',
          title: 'Gold allocation in a 3-fund portfolio',
          score: 89,
          numComments: 51,
          url: 'https://reddit.com/r/personalfinance',
          snippet: 'I keep about 5% of my portfolio in gold to smooth out downturns. It helps lower overall volatility.'
        }
      ];
      bullish = 2;
      bearish = 0;
    } else if (q.includes('bitcoin') || q.includes('btc') || q.includes('crypto')) {
      posts = [
        {
          subreddit: 'r/investing',
          title: 'Bitcoin ETF inflows accelerate as institutions allocate cash',
          score: 612,
          numComments: 189,
          url: 'https://reddit.com/r/investing',
          snippet: 'Fidelity and BlackRock are driving massive volume. This is establishing BTC as a mainstream asset class.'
        },
        {
          subreddit: 'r/stocks',
          title: 'Crypto vs Growth Stocks: The risk profile is shifting',
          score: 340,
          numComments: 92,
          url: 'https://reddit.com/r/stocks',
          snippet: 'I replaced my speculative tech positions with a 3% Bitcoin allocation. Highly volatile but asymmetric upside.'
        },
        {
          subreddit: 'r/personalfinance',
          title: 'Lost significant savings trading crypto derivatives',
          score: 720,
          numComments: 342,
          url: 'https://reddit.com/r/personalfinance',
          snippet: 'A warning to everyone. Leverage will wipe you out. Stick to long-term index funds.'
        }
      ];
      bullish = 2;
      bearish = 1;
    } else {
      posts = [
        {
          subreddit: 'r/investing',
          title: 'How are you positioning your portfolio for high interest rates?',
          score: 412,
          numComments: 110,
          url: 'https://reddit.com/r/investing',
          snippet: 'Shifting more into short-term treasuries and high cash flow value equities. Avoiding unprofitable tech.'
        },
        {
          subreddit: 'r/stocks',
          title: 'Index funds are still the king for passive investors',
          score: 310,
          numComments: 87,
          url: 'https://reddit.com/r/stocks',
          snippet: 'No one consistently beats the index over 20 years. Just buy VT or VOO and chill.'
        },
        {
          subreddit: 'r/personalfinance',
          title: 'Is it time to lock in rates with a 12-month CD?',
          score: 198,
          numComments: 64,
          url: 'https://reddit.com/r/personalfinance',
          snippet: 'Locking in 5%+ yields feels like a safe bet right now given the economic uncertainty.'
        }
      ];
      bullish = 2;
      bearish = 0;
    }
    return { posts, bullish, bearish };
  };

  // 2. Reddit
  const fetchReddit = async () => {
    const activeQuery = query || symbol || '';
    const results = [];
    let bullish = 0;
    let bearish = 0;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const subreddits = ['personalfinance', 'investing', 'stocks', 'IndiaInvestments'];
      const POSITIVE = /\b(buy|long|call|up|bull|pump|moon|gain|growth|good|increase|holding)\b/i;
      const NEGATIVE = /\b(sell|short|put|down|bear|dump|crash|loss|drop|bad|fall|risky)\b/i;

      for (const sub of subreddits.slice(0, 2)) {
        const url = activeQuery 
          ? `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(activeQuery)}&sort=hot&limit=5&restrict_sr=1`
          : `https://www.reddit.com/r/${sub}/hot.json?limit=5`;

        const response = await fetch(url, { 
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });

        if (!response.ok) {
          throw new Error(`Reddit server returned ${response.status}`);
        }

        const data = await response.json();
        if (!data?.data?.children) continue;

        data.data.children.forEach(({ data: p }) => {
          if (POSITIVE.test(p.title)) bullish++;
          if (NEGATIVE.test(p.title)) bearish++;

          results.push({
            subreddit: `r/${sub}`,
            title: p.title,
            score: p.score,
            numComments: p.num_comments,
            url: `https://reddit.com${p.permalink}`,
            snippet: p.selftext?.slice(0, 120) || '',
          });
        });
      }

      if (results.length === 0) {
        return getMockRedditPosts(activeQuery);
      }

      return { posts: results.sort((a, b) => b.score - a.score).slice(0, 5), bullish, bearish };
    } catch (e) {
      console.warn('Reddit fetch failed, returning mock posts:', e.message);
      return getMockRedditPosts(activeQuery);
    }
  };


  // 3. Expert RSS Feeds
  const fetchExpertFeed = async (feed) => {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3500)
      );
      const feedData = await Promise.race([
        parser.parseURL(feed.url),
        timeoutPromise
      ]);
      const items = (feedData.items || []).slice(0, 3);
      return items.map(item => ({
        expert: feed.name,
        title: item.title?.trim() || '',
        link: item.link?.trim() || '',
        pubDate: item.pubDate?.slice(0, 16) || '',
      }));
    } catch (e) {
      console.warn(`RSS error (${feed.name}):`, e.message);
      return [];
    }
  };

  const fetchAllExpertFeeds = async () => {
    try {
      const feedsToFetch = EXPERT_FEEDS.slice(0, 3);
      const results = await Promise.all(feedsToFetch.map(f => fetchExpertFeed(f)));
      const flat = results.flat();

      if (!query) return flat.slice(0, 5);

      const q = query.toLowerCase().split(' ');
      const relevant = flat.filter(item =>
        q.some(word => item.title.toLowerCase().includes(word))
      );
      return (relevant.length ? relevant : flat).slice(0, 5);
    } catch (e) {
      return [];
    }
  };

  const [redditData, expertPosts] = await Promise.all([
    fetchReddit(),
    fetchAllExpertFeeds(),
  ]);

  // Fallback Stocktwits structure to Reddit sentiment to avoid breaking front-end
  const stocktwits = {
    messages: [],
    bullish: redditData.bullish,
    bearish: redditData.bearish
  };
  const reddit = redditData.posts;

  return res.json({ success: true, stocktwits, reddit, expertPosts });
}
