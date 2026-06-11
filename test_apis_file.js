import fs from 'fs';
import marketHandler from './api/market.js';
import socialHandler from './api/social.js';

async function test() {
  const reqTemplate = {
    method: 'POST',
    body: { message: 'gold', symbol: 'GLD' }
  };

  const createRes = (name) => ({
    status: (code) => ({
      json: (data) => fs.writeFileSync(`test_${name.toLowerCase()}.json`, JSON.stringify(data, null, 2))
    }),
    json: (data) => fs.writeFileSync(`test_${name.toLowerCase()}.json`, JSON.stringify(data, null, 2))
  });

  await socialHandler({...reqTemplate}, createRes('Social'));
  await marketHandler({...reqTemplate}, createRes('Market'));
}

test();
