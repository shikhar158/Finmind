import marketHandler from './api/market.js';
import socialHandler from './api/social.js';

async function test() {
  const reqTemplate = {
    method: 'POST',
    body: { message: 'should I buy gold or bitcoin', country: 'US', holdings: [] }
  };

  const createRes = (name) => ({
    status: (code) => ({
      json: (data) => console.log(`[${name}] Status ${code}:`, JSON.stringify(data, null, 2))
    }),
    json: (data) => console.log(`[${name}] SUCCESS:`, JSON.stringify(data, null, 2))
  });

  console.log('Testing Social API...');
  await socialHandler({...reqTemplate, body: { message: 'gold', symbol: 'GLD' }}, createRes('Social'));

  console.log('\nTesting Market API...');
  await marketHandler({...reqTemplate, body: { message: 'gold' }}, createRes('Market'));
}

test();
