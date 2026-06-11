// ============================================================
// tone.js — Backend Delegation for Tone Analysis
// ============================================================

const ToneAnalyzer = (() => {
  async function analyze(text) {
    try {
      const res = await fetch('/api/tone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      const data = await res.json();
      if (data.success) {
        // Returns { sentiment, sentimentScore, emotion, urgency, biases }
        return data; 
      }
      throw new Error(data.error || 'Tone analysis failed');
    } catch (err) {
      console.error('Tone lookup error:', err);
      // Fallback object to prevent application crash
      return {
        sentiment: 'neutral',
        sentimentScore: 0.5,
        emotion: 'Analytical',
        urgency: 'Low',
        biases: [],
        source: 'client_fallback'
      };
    }
  }

  return { analyze };
})();
