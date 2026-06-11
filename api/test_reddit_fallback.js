import fs from 'fs';

// Mock the environment/variables
const query = '';
const symbol = '';

async function testReddit() {
  const activeQuery = query || symbol || '';
  let log = '';

  try {
    const subreddits = ['personalfinance', 'investing', 'stocks', 'IndiaInvestments'];
    const results = [];
    let bullish = 0;
    let bearish = 0;

    const POSITIVE = /\b(buy|long|call|up|bull|pump|moon|gain|growth|good|increase|holding)\b/i;
    const NEGATIVE = /\b(sell|short|put|down|bear|dump|crash|loss|drop|bad|fall|risky)\b/i;

    for (const sub of subreddits.slice(0, 2)) {
      const url = activeQuery 
        ? `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(activeQuery)}&sort=hot&limit=5&restrict_sr=1`
        : `https://www.reddit.com/r/${sub}/hot.json?limit=5`;

      log += `Fetching ${url}...\n`;
      const response = await fetch(url, { 
        headers: {
          'User-Agent': 'FinMindBot/1.0 (contact: support@finmind.ai)'
        }
      });
      const data = await response.json();
      if (!data?.data?.children) {
        log += `No data for ${sub}\n`;
        continue;
      }

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
    log += `Total results: ${results.length}\n`;
    log += `Bullish: ${bullish}, Bearish: ${bearish}\n`;
    if (results.length > 0) {
      log += `First Title: ${results[0].title}\n`;
    }
  } catch (e) {
    log += `Catch: ${e.message}\n`;
  }

  fs.writeFileSync('debug_fallback.txt', log);
  console.log('Log written to debug_fallback.txt');
}

testReddit();
