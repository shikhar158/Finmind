// ============================================================
// agent.js — Backend Delegation for Advice Engine
// ============================================================

const Agent = (() => {
  async function getAdvice(userMessage, conversationHistory, user, ps, tone, market, social, customPrompt = null) {
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userMessage, 
          conversationHistory, 
          user, 
          ps, 
          tone, 
          market, 
          social, 
          customPrompt 
        })
      });

      const data = await res.json();
      if (data.success) {
        return data.content;
      }
      throw new Error(data.error || 'Groq AI models failed');
    } catch (err) {
      console.error('Agent lookup error:', err);
      throw err;
    }
  }

  return { getAdvice };
})();
