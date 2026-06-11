const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

function buildPrompt(user, ps, tone, market, social) {
  const stress = ps.stressScore >= 7 ? 'CRITICAL' : ps.stressScore >= 4 ? 'MODERATE' : 'LOW';

  const holdings = (ps.holdingsSummary || 'Not uploaded').slice(0, 400);
  const txns = (ps.transactionsSummary || 'Not uploaded').slice(0, 400);
  const income = (ps.incomeSummary || 'Not provided').slice(0, 200);
  const flags = (ps.stressFlags || []).slice(0, 3).join('; ') || 'None';

  const news = (market.news || []).slice(0, 3)
                .map(n => `[${n.source}] ${n.title}`.slice(0, 90)).join(' | ') || 'None';
  const price = market.price
                ? `${market.price.asset} ${market.price.currency}${market.price.price} (${market.price.change || '?' }%)`
                : 'N/A';

  const st = (social.stocktwits?.bullish > 0 || social.stocktwits?.bearish > 0)
              ? `🐂${social.stocktwits.bullish} 🐻${social.stocktwits.bearish}`
              : 'Unavailable (Deduce general sentiment from Reddit titles instead)';
  const reddit = (social.reddit || []).slice(0, 2)
                .map(r => r.title.slice(0, 70)).join(' | ') || 'N/A';
  const expert = (social.expertPosts || []).slice(0, 2)
                .map(e => `[${e.expert.split('(')[0].trim()}] ${e.title}`.slice(0, 90)).join(' | ') || 'N/A';

  const biases = tone.biases?.join(', ') || 'None';
  const goals = (user.profile?.goals || []).slice(0, 3).join(', ') || 'Not set';

  return `You are FinMind, a warm, compassionate, and highly unique behavioral finance AI advisor. 
Write in an engaging, natural "talking mode"—speak like a wise, friendly human mentor, not a robotic template generator.
AVOID cookie-cutter list intros or robotic summaries. Blend your insights naturally into flowing conversational paragraphs.

USER: ${user.name || 'User'}, age ${ps.profile?.age || '?'}, ${ps.profile?.occupation || 'unknown occupation'}
Goals: ${goals} | Risk: ${user.profile?.riskScore || '?'}/10
Net worth: ₹${(ps.netWorth || 0).toLocaleString()} | Stress: ${stress} (${ps.stressScore}/10)
Stress flags: ${flags}
Income (6mo): ${income}
Holdings: ${holdings}
Recent txns: ${txns}

BEHAVIOR: Sentiment=${tone.sentiment}(${Math.round((tone.sentimentScore || 0.5) * 100)}%), Emotion=${tone.emotion}, Urgency=${tone.urgency}
Biases detected: ${biases}

MARKET: ${price} | News: ${news}
StockTwits: ${st} | Reddit: ${reddit}
Expert: ${expert}

RULES:
- TALKING MODE: Speak conversationally, using natural transitions and dynamic phrasing. Vary your structure.
- EXPLICIT DATA: You MUST quote 1-2 specific numbers from the user's profile context (like their exact age, net worth, or specific asset holdings).
- CURRENCY: ALWAYS use the correct currency symbol provided in the context (e.g., $ or USD for commodities/stocks, ₹ for Indian Rupee net worth). DO NOT use ₹ for USD prices.
- NEWS/MARKET: You MUST quote at least one live news headline, StockTwits sentiment data, or market price provided below to back up your views. 
- Name each detected bias and explain its behavioral effect in a talking, natural way.
- Tone: warm and gentle if user is anxious/fearful, direct and grounding if calm, cautious and risk-focused if user is overconfident.
- End with 2-3 actionable "TODAY" steps written as a friendly closing thought.`;
}

function generateFallbackAdvice(user, ps, tone, market, social) {
  const name = user.name || 'User';
  const age = ps.profile?.age || '';
  const netWorth = ps.netWorth || 0;
  const biases = tone.biases || [];
  const emotion = tone.emotion || 'Analytical';
  const urgency = tone.urgency || 'Low';
  
  const assetName = market.price?.asset || '';
  const priceStr = market.price 
    ? `${market.price.currency} ${market.price.price} (${market.price.change || '0'}%)` 
    : '';
  const changePercent = market.price ? parseFloat(market.price.change || 0) : 0;
  
  const newsHeadline = market.news && market.news.length > 0 
    ? market.news[0].title 
    : '';

  // 1. Empathy / Behavior Intro (Talking Mode)
  let intro = "";
  if (ps.stressScore >= 7) {
    intro = `Hey ${name}, I can hear the stress in your query, and it's completely understandable to feel overwhelmed when markets behave like this. You marked your stress level as a high ${ps.stressScore}/10. At age ${age || 'your current age'}, with a solid net worth of ₹${netWorth.toLocaleString('en-IN')}, you have built a resilient foundation. Before making any sudden moves, let's take a deep breath. Focus on what you can control—your immediate liquidity and peace of mind.`;
  } else if (emotion === 'Anxious' || emotion === 'Fearful' || emotion === 'Panicked') {
    intro = `Hi ${name}. It sounds like there is a bit of anxiety or fear creeping into your financial thoughts right now. That is very normal—we are wired to protect what we've earned. Since we are seeing a ${urgency.toLowerCase()} urgency behavior pattern here, let's step back, slow down the decision-making cycle, and look at the actual data rather than the noise.`;
  } else if (emotion === 'Confident' || emotion === 'Excited') {
    intro = `Hello ${name}! I love the enthusiasm and confidence in your query. It's great to feel optimistic when exploring opportunities like ${assetName || 'the markets'}. However, when confidence runs high, our brains sometimes skip over the potential risks. Let's make sure we ground that excitement in a balanced strategy that protects your net worth of ₹${netWorth.toLocaleString('en-IN')}.`;
  } else {
    intro = `Hello ${name}. I really appreciate your structured, analytical approach. Since your current state is matching a calm, measured **${emotion}** profile with **${urgency} urgency**, let's co-create a clear, rational assessment of your query.`;
  }

  // 2. Dynamic Behavioral Bias analysis
  let biasText = "";
  if (biases.length > 0) {
    const list = biases.map(b => b.replace(/_/g, ' '));
    biasText = `\n\nLooking closely, I notice some psychological signals in your phrasing—specifically elements of **${list.join(' and ')}**. `;
    
    biases.forEach(b => {
      const lower = b.toLowerCase();
      if (lower.includes('loss_aversion') || lower.includes('loss aversion')) {
        biasText += `*Loss Aversion* is likely driving you to feel the pain of a potential drop twice as strongly as the pleasure of a gain. This is what tempts us to exit solid long-term investments prematurely just to stop short-term discomfort. `;
      } else if (lower.includes('fomo')) {
        biasText += `*FOMO (Fear of Missing Out)* is whispering that if you don't jump into ${assetName || 'this trend'} immediately, you will miss the train. Historically, buying at the peak of social hype is a high-risk gamble. `;
      } else if (lower.includes('overconfidence')) {
        biasText += `*Overconfidence* might be causing you to underestimate the volatility of ${assetName || 'the asset'} or assume we can time the entry perfectly. Markets are inherently unpredictable. `;
      } else if (lower.includes('herd')) {
        biasText += `*Herd Mentality* is pulling you to do what everyone else is doing. But successful investing usually requires the patience to stand apart from the crowd. `;
      } else {
        biasText += `These mental shortcuts can skew your long-term plans. Recognizing them is the first step to neutralising them. `;
      }
    });
  } else {
    biasText = `\n\nI don't detect any active cognitive biases in your query, which is excellent. You are keeping a level head.`;
  }

  // 3. Conversational Market Context
  let marketText = "";
  if (priceStr || newsHeadline) {
    marketText = `\n\nRegarding the markets right now: **${assetName || 'the asset'}** is trading at **${priceStr || 'current rates'}**. `;
    if (changePercent < 0) {
      marketText += `It is down slightly (${changePercent}%), which is sparking some negative discussions. `;
    } else if (changePercent > 0) {
      marketText += `It is up (${changePercent}%), which is naturally drawing some bullish attention. `;
    }
    
    if (newsHeadline) {
      marketText += `In fact, the headlines are actively reporting: *"${newsHeadline}"*. `;
    }

    const stBull = social.stocktwits?.bullish || 0;
    const stBear = social.stocktwits?.bearish || 0;
    if (stBull > 0 || stBear > 0) {
      marketText += `Social sentiment on boards shows ${stBull} bullish voices vs ${stBear} bearish voices. `;
    } else {
      marketText += `Social channels and community boards show active discussions around this asset's next movements. `;
    }
  }

  // 4. Custom actionable plans (Talking Mode)
  let actionText = "";
  if (ps.stressScore >= 7) {
    actionText = `\n\nHere are 3 quick actions we should focus on TODAY to protect your peace of mind:
1. **Double Check Cash Reserves:** Ensure you have 3 to 6 months of living expenses in an instantly liquid account before funding any new asset purchases.
2. **Hit Pause on Trading:** Commit to not buying or selling anything for the next 24 hours. Sleep on it to strip the emotion away.
3. **Verify Your Risk Settings:** Make sure your current portfolio setup matches your target risk score of ${user.profile?.riskScore || 5}/10.`;
  } else if (emotion === 'Confident' || emotion === 'Excited') {
    actionText = `\n\nLet's map out 3 proactive steps for TODAY to keep your portfolio balanced:
1. **Enforce Position Limits:** Never allocate more than 5% of your total net worth (₹${(netWorth).toLocaleString('en-IN')}) into a single high-risk asset or cryptocurrency.
2. **Review Your Asset Allocation:** Check if the recent price moves have drifted your portfolio away from your long-term plan.
3. **Write Down Your Investment Thesis:** Before clicking buy, write 3 sentences explaining exactly when and why you will sell this asset in the future.`;
  } else {
    actionText = `\n\nHere is a sensible action plan for TODAY to proceed:
1. **Analyze Allocation Limits:** Before acquiring more ${assetName || 'assets'}, review your current holdings to ensure you remain diversified.
2. **Maintain Emergency Funding:** Make sure your emergency cash reserve is intact and yielding high interest.
3. **Sync Portfolio Template:** Keep your portfolio uploaded and synchronized in the dashboard so we can track allocations accurately.`;
  }

  return `${intro}${biasText}${marketText}${actionText}\n\n*(Note: Running in FinMind Local Advice Mode. Set GROQ_API_KEY in your environment to enable Llama AI advice.)*`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { userMessage, conversationHistory, user, ps, tone, market, social, customPrompt } = req.body;
  const groqKey = process.env.GROQ_API_KEY;

  if (!groqKey || groqKey.includes('placeholder')) {
    console.warn('⚠️ GROQ_API_KEY is missing, generating rule-based local fallback advice.');
    const content = generateFallbackAdvice(user, ps, tone, market, social);
    return res.json({ success: true, content });
  }

  const systemPrompt = customPrompt || buildPrompt(user, ps, tone, market, social);

  const stdHistory = [
    { role: 'system', content: systemPrompt },
    { role: 'assistant', content: "Hello! I'm FinMind. I've reviewed your profile and I'm here to help. What's on your mind?" },
    ...conversationHistory.slice(-6).map(m => ({
      role: m.role,
      content: m.content.slice(0, 800)
    })),
    { role: 'user', content: userMessage }
  ];

  let lastError = null;

  for (const model of GROQ_MODELS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout

    try {
      const gResponse = await fetch(GROQ_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: stdHistory,
          temperature: 0.7,
          max_tokens: 600,
          top_p: 0.9,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await gResponse.json();
      if (data?.choices?.[0]?.message?.content) {
        return res.json({ success: true, content: data.choices[0].message.content });
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`Groq Model ${model} failed:`, err.message);
      lastError = err;
    }
  }

  return res.status(502).json({ success: false, error: lastError?.message || 'Groq AI models failed' });
}
