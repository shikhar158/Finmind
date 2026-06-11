const MODEL = 'ProsusAI/finbert';
const HF_API = 'https://api-inference.huggingface.co/models/';

const EMOTION_MAP = {
  positive: ['hopeful', 'confident', 'excited', 'optimistic', 'calm'],
  neutral:  ['analytical', 'curious', 'measured', 'informational'],
  negative: ['anxious', 'fearful', 'stressed', 'frustrated', 'panicked'],
};

const BIAS_KEYWORDS = {
  'Loss Aversion':       ['losing', 'lost', 'drop', 'crash', 'down', 'fall', 'negative', 'scared', 'worried'],
  'FOMO':                ['everyone', 'missing out', 'fomo', 'all buying', 'getting in', 'too late', 'moon'],
  'Overconfidence':      ['sure', 'definitely', 'guaranteed', 'will double', 'cant lose', "100%", 'always goes up'],
  'Herd Mentality':      ['everyone', 'all my friends', 'people are', 'trending', 'popular', 'following'],
  'Anchoring':           ['it was', 'used to be', 'remember when', 'back to', 'return to'],
  'Recency Bias':        ['lately', 'recently', 'last week', 'these days', 'right now', 'just happened'],
  'Sunk Cost Fallacy':   ['already invested', 'put so much', 'cant sell now', 'already lost', 'holding anyway'],
  'Confirmation Bias':   ['i knew it', 'proves', 'told you', 'obviously', 'just as i thought'],
};

const URGENCY_HIGH = ['now', 'immediately', 'asap', 'right now', 'urgent', 'panic', 'crash', 'emergency', 'quick'];
const URGENCY_MED  = ['soon', 'should i', 'thinking about', 'considering', 'planning to', 'this week'];

function keywordFallback(text) {
  const t = text.toLowerCase();
  const negWords = ['scared', 'panic', 'crash', 'lose', 'lost', 'worried', 'afraid', 'terrible', 'bad', 'falling'];
  const posWords = ['great', 'good', 'rising', 'profit', 'gain', 'bullish', 'growth', 'hopeful', 'confident'];
  let neg = negWords.filter(w => t.includes(w)).length;
  let pos = posWords.filter(w => t.includes(w)).length;
  if (neg > pos) return { label: 'negative', score: 0.7 + neg * 0.05, source: 'keyword' };
  if (pos > neg) return { label: 'positive', score: 0.7 + pos * 0.05, source: 'keyword' };
  return { label: 'neutral', score: 0.6, source: 'keyword' };
}

function detectBiases(text) {
  const t = text.toLowerCase();
  const found = [];
  for (const [bias, keywords] of Object.entries(BIAS_KEYWORDS)) {
    if (keywords.some(k => t.includes(k))) found.push(bias);
  }
  return found;
}

function detectUrgency(text) {
  const t = text.toLowerCase();
  if (URGENCY_HIGH.some(w => t.includes(w))) return 'High';
  if (URGENCY_MED.some(w => t.includes(w))) return 'Medium';
  return 'Low';
}

function mapEmotion(label, text) {
  const t = text.toLowerCase();
  if (label === 'negative') {
    if (t.includes('panic') || t.includes('crash') || t.includes('everything')) return 'Panicked';
    if (t.includes('stress') || t.includes('worried') || t.includes('scared')) return 'Anxious';
    if (t.includes('frustrated') || t.includes('angry')) return 'Frustrated';
    return 'Fearful';
  }
  if (label === 'positive') {
    if (t.includes('exciting') || t.includes('amazing') || t.includes('moon')) return 'Excited';
    if (t.includes('confident') || t.includes('sure') || t.includes('definitely')) return 'Confident';
    return 'Hopeful';
  }
  return 'Analytical';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ success: false, error: 'Text input is required' });

  const hfKey = process.env.HF_API_KEY;
  if (!hfKey) {
     const biases = detectBiases(text);
     const urgency = detectUrgency(text);
     const fallback = keywordFallback(text);
     const emotion = mapEmotion(fallback.label, text);
     return res.json({
        success: true,
        sentiment: fallback.label,
        sentimentScore: fallback.score,
        emotion,
        urgency,
        biases,
        source: 'fallback_no_key'
     });
  }

  try {
    const hfResponse = await fetch(`${HF_API}${MODEL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
    });

    if (!hfResponse.ok) throw new Error(`HF API error ${hfResponse.status}`);
    
    const data = await hfResponse.json();
    const sorted = (Array.isArray(data[0]) ? data[0] : data).sort((a, b) => b.score - a.score);
    const result = { label: sorted[0].label.toLowerCase(), score: sorted[0].score, source: 'finbert' };

    const biases = detectBiases(text);
    const urgency = detectUrgency(text);
    const emotion = mapEmotion(result.label, text);

    return res.json({
      success: true,
      sentiment: result.label,
      sentimentScore: Math.min(result.score, 1.0),
      emotion,
      urgency,
      biases,
      source: result.source
    });

  } catch (e) {
    console.warn('FinBERT backend fallback:', e.message);
    const biases = detectBiases(text);
    const urgency = detectUrgency(text);
    const fallback = keywordFallback(text);
    const emotion = mapEmotion(fallback.label, text);
    return res.json({
      success: true,
      sentiment: fallback.label,
      sentimentScore: fallback.score,
      emotion,
      urgency,
      biases,
      source: 'fallback_backend_error'
    });
  }
}
