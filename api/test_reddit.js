import fs from 'fs';

async function testReddit() {
  const query = 'gold';
  const sub = 'investing';
  const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&sort=hot&limit=5&restrict_sr=1`;
  let log = '';

  log += `Fetching ${url} without User-Agent...\n`;
  try {
    const res = await fetch(url);
    log += `No User-Agent Status: ${res.status}\n`;
    if (res.ok) {
      const data = await res.json();
      log += `No User-Agent Data length: ${data?.data?.children?.length || 0}\n`;
    } else {
      log += `No User-Agent Error: ${await res.text()}\n`;
    }
  } catch (e) {
    log += `No User-Agent Catch: ${e.message}\n`;
  }

  log += `\nFetching ${url} WITH User-Agent...\n`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'FinMindBot/1.0 (contact: support@finmind.ai)'
      }
    });
    log += `With User-Agent Status: ${res.status}\n`;
    if (res.ok) {
      const data = await res.json();
      log += `With User-Agent Data length: ${data?.data?.children?.length || 0}\n`;
      if (data?.data?.children?.[0]?.data?.title) {
        log += `First Title: ${data.data.children[0].data.title}\n`;
      }
    } else {
      log += `With User-Agent Error: ${await res.text()}\n`;
    }
  } catch (e) {
    log += `With User-Agent Catch: ${e.message}\n`;
  }

  fs.writeFileSync('debug_log.txt', log);
  console.log('Log written to debug_log.txt');
}

testReddit();

