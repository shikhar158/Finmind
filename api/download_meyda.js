import fs from 'fs';

async function download() {
  const urls = [
    'https://cdnjs.cloudflare.com/ajax/libs/meyda/5.6.0/meyda.min.js',
    'https://unpkg.com/meyda/dist/meyda.min.js',
    'https://cdn.jsdelivr.net/npm/meyda/dist/meyda.min.js',
    'https://unpkg.com/meyda'
  ];
  
  let log = '';
  
  for (const url of urls) {
    log += `Trying ${url}...\n`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      log += `Status: ${res.status}\n`;
      if (res.ok) {
        const text = await res.text();
        fs.writeFileSync('js/meyda.min.js', text);
        log += `SUCCESS with ${url}\n`;
        break;
      }
    } catch (e) {
      log += `Error with ${url}: ${e.message}\n`;
    }
  }
  fs.writeFileSync('download_log.txt', log);
  console.log('Log written to download_log.txt');
}

download();

