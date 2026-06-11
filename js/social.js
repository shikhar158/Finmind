// ============================================================
// social.js — Backend Delegation for Social Data
// ============================================================

const SocialData = (() => {
  async function getCommunityContext(userMessage, symbol) {
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, symbol })
      });

      const data = await res.json();
      if (data.success) {
        return { 
          stocktwits: data.stocktwits || { messages: [], bullish: 0, bearish: 0 }, 
          reddit: data.reddit || [], 
          expertPosts: data.expertPosts || [] 
        };
      }
      throw new Error(data.error || 'Social fetch failed');
    } catch (err) {
      console.error('Social lookup error:', err);
      return { 
        stocktwits: { messages: [], bullish: 0, bearish: 0 }, 
        reddit: [], 
        expertPosts: [] 
      };
    }
  }

  return { getCommunityContext };
})();
