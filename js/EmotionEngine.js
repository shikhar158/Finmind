// ============================================================
//  emotionEngine.js  —  FinMind Emotion-Aware AI Engine
//  Drop this file into your finance-agent/ folder and add:
//  <script src="emotionEngine.js"></script>  in index.html
//  before your existing Groq call script.
// ============================================================

const EmotionEngine = (() => {

    // ─────────────────────────────────────────────────────────
    //  1. CONSTANTS & CONFIG
    // ─────────────────────────────────────────────────────────

    const CONFIDENCE_THRESHOLD = 0.70;   // below this → call Groq
    const CACHE_TTL_MS = 30 * 60 * 1000;  // 30 minutes
    const MAX_PROMPT_TOKENS = 800;    // hard cap on tokens sent to Groq
    const SESSION_KEY = 'efaa_session';
    const CACHE_KEY = 'efaa_response_cache';

    // Bias keyword patterns — maps regex to bias name
    const BIAS_PATTERNS = [
        { bias: 'panic_selling', regex: /\b(sell everything|get out|pull out|exit now|liquidate|crash|collapse|going to zero)\b/i },
        { bias: 'fomo', regex: /\b(everyone (is |)buying|missing out|too late|already up|should i buy now|moon|pump)\b/i },
        { bias: 'loss_aversion', regex: /\b(lost|losing|lose|down \d|portfolio (is |)red|can't afford to lose|recover)\b/i },
        { bias: 'overconfidence', regex: /\b(guaranteed|sure thing|definitely going up|can't fail|100%|easy money)\b/i },
        { bias: 'recency_bias', regex: /\b(last week|yesterday|today|just dropped|just pumped|recently|this month)\b/i },
        { bias: 'anchoring', regex: /\b(was at|used to be|all.time high|ath|back to|waiting for it to return)\b/i },
        { bias: 'debt_avoidance', regex: /\b(don't want to look|ignoring|avoiding|scared to check|buried in debt)\b/i },
        { bias: 'mental_accounting', regex: /\b(bonus|windfall|found money|free money|it's just|only a small amount)\b/i },
    ];

    // Urgency word scores (additive)
    const URGENCY_WORDS = {
        'immediately': 3, 'right now': 3, 'emergency': 4, 'asap': 3,
        'today': 1, 'urgent': 3, 'now': 1, 'quick': 1, 'fast': 1,
        'panic': 4, 'scared': 3, 'terrified': 4, 'worried': 2,
        'losing everything': 5, 'going broke': 5, 'what do i do': 3,
    };

    // High-stakes financial keywords — triggers Groq even if confident
    const HIGH_STAKES_REGEX = /\b(\d{4,}|lakh|crore|invest|withdraw|sell|buy|loan|emi|debt|bankrupt|retire|all.in)\b/i;

    // Emotional state → intervention type mapping
    const INTERVENTION_MAP = {
        panic: { type: 'friction', tone: 'calm', maxSentences: 3 },
        fear: { type: 'reframe', tone: 'reassuring', maxSentences: 4 },
        fomo: { type: 'reality_check', tone: 'grounding', maxSentences: 4 },
        overconfidence: { type: 'risk_nudge', tone: 'balanced', maxSentences: 4 },
        anxiety: { type: 'simplify', tone: 'supportive', maxSentences: 5 },
        grief: { type: 'protect', tone: 'empathetic', maxSentences: 4 },
        calm: { type: 'empower', tone: 'analytical', maxSentences: 6 },
        neutral: { type: 'none', tone: 'helpful', maxSentences: 5 },
    };

    // ─────────────────────────────────────────────────────────
    //  2. SESSION TRACKER
    //  Tracks behavioral signals across the current session
    // ─────────────────────────────────────────────────────────

    const Session = {
        data: null,

        init() {
            const stored = localStorage.getItem(SESSION_KEY);
            const now = Date.now();

            if (stored) {
                const parsed = JSON.parse(stored);
                // Reset session if last activity > 30 min ago
                if (now - parsed.lastActivity > 30 * 60 * 1000) {
                    this.data = this._fresh(now);
                } else {
                    this.data = parsed;
                }
            } else {
                this.data = this._fresh(now);
            }
            this._save();
            return this;
        },

        _fresh(now) {
            return {
                startTime: now,
                lastActivity: now,
                loginCount: 1,
                messageCount: 0,
                clicksPerMinute: 0,
                lastClickTime: now,
                clickBuffer: [],           // timestamps of last 10 clicks
                pagesVisited: [],
                hourOfDay: new Date(now).getHours(),
                daysSinceLastVisit: this._daysSinceLastVisit(),
                portfolioChecks: 0,
                sellIntents: 0,            // times user tried to sell
                totalMessages: 0,
            };
        },

        _daysSinceLastVisit() {
            const last = localStorage.getItem('efaa_last_visit');
            if (!last) return 0;
            return Math.floor((Date.now() - parseInt(last)) / (1000 * 60 * 60 * 24));
        },

        // Call this on every user click anywhere in the app
        recordClick() {
            const now = Date.now();
            this.data.clickBuffer.push(now);
            // Keep only last 10 clicks
            if (this.data.clickBuffer.length > 10) this.data.clickBuffer.shift();
            // Calculate clicks per minute from buffer
            if (this.data.clickBuffer.length >= 2) {
                const span = (now - this.data.clickBuffer[0]) / 60000; // minutes
                this.data.clicksPerMinute = span > 0
                    ? Math.round(this.data.clickBuffer.length / span)
                    : 0;
            }
            this.data.lastActivity = now;
            this._save();
        },

        // Call this when user navigates to a page/section
        recordPageVisit(pageName) {
            this.data.pagesVisited.push({ page: pageName, time: Date.now() });
            if (pageName.toLowerCase().includes('portfolio')) this.data.portfolioChecks++;
            if (pageName.toLowerCase().includes('sell') ||
                pageName.toLowerCase().includes('withdraw')) this.data.sellIntents++;
            this._save();
        },

        // Call this on every message sent
        recordMessage() {
            this.data.messageCount++;
            this.data.totalMessages++;
            this.data.lastActivity = Date.now();
            localStorage.setItem('efaa_last_visit', Date.now().toString());
            this._save();
        },

        _save() {
            localStorage.setItem(SESSION_KEY, JSON.stringify(this.data));
        },

        get() { return this.data; }
    };

    // ─────────────────────────────────────────────────────────
    //  3. BEHAVIORAL SCORER
    //  Pure JS — scores session signals 0–10, no API needed
    // ─────────────────────────────────────────────────────────

    function scoreBehavior(session) {
        let score = 0;
        const signals = [];

        // Late night login (10pm–4am) → high stress signal
        const hour = session.hourOfDay;
        if (hour >= 22 || hour <= 4) {
            score += 3;
            signals.push('late_night_session');
        }

        // Very rapid clicking → arousal/panic
        if (session.clicksPerMinute > 30) {
            score += 4;
            signals.push('rapid_clicking');
        } else if (session.clicksPerMinute > 15) {
            score += 2;
            signals.push('elevated_clicking');
        }

        // Long absence then sudden return → avoidance pattern broken
        if (session.daysSinceLastVisit > 14) {
            score += 3;
            signals.push('long_absence');
        } else if (session.daysSinceLastVisit > 7) {
            score += 1;
            signals.push('week_absence');
        }

        // Obsessive checking — many logins/checks today
        if (session.portfolioChecks > 5) {
            score += 3;
            signals.push('obsessive_checking');
        } else if (session.portfolioChecks > 2) {
            score += 1;
            signals.push('frequent_checking');
        }

        // Sell intent navigation
        if (session.sellIntents > 0) {
            score += 2;
            signals.push('sell_intent_navigation');
        }

        // High message frequency in session
        if (session.messageCount > 8) {
            score += 2;
            signals.push('high_message_frequency');
        }

        // Normalize to 0–1
        const normalized = Math.min(score / 10, 1.0);
        return { score: normalized, signals };
    }

    // ─────────────────────────────────────────────────────────
    //  4. URGENCY SCORER
    //  Scans message text for urgency/panic language
    // ─────────────────────────────────────────────────────────

    function scoreUrgency(text) {
        const lower = text.toLowerCase();
        let score = 0;
        const detected = [];

        for (const [word, weight] of Object.entries(URGENCY_WORDS)) {
            if (lower.includes(word)) {
                score += weight;
                detected.push(word);
            }
        }

        // Question marks = uncertainty/anxiety
        const questionCount = (text.match(/\?/g) || []).length;
        score += Math.min(questionCount * 0.5, 2);

        // ALL CAPS words = strong emotional arousal
        const capsWords = (text.match(/\b[A-Z]{3,}\b/g) || []).length;
        score += Math.min(capsWords * 1.5, 3);

        // Exclamation marks
        const exclCount = (text.match(/!/g) || []).length;
        score += Math.min(exclCount * 0.5, 2);

        const normalized = Math.min(score / 12, 1.0);
        return { score: normalized, triggers: detected };
    }

    // ─────────────────────────────────────────────────────────
    //  5. BIAS DETECTOR
    //  Scans message for all 8 cognitive biases
    // ─────────────────────────────────────────────────────────

    function detectBiases(text) {
        const active = [];
        for (const { bias, regex } of BIAS_PATTERNS) {
            if (regex.test(text)) active.push(bias);
        }
        return active;
    }

    // ─────────────────────────────────────────────────────────
    //  6. LOCAL FUSION MODEL
    //  Combines all 4 signals into a final emotional state
    //  Weight tuning: behavioral 25%, urgency 30%, bias 25%, finbert 20%
    // ─────────────────────────────────────────────────────────

    function fuseSignals({ behaviorScore, urgencyScore, activeBiases, finbertScore, finbertLabel, toneResult = null }) {
        const toneScore = toneResult?.toneScore || 0;
        const voiceConfidence = toneResult ? 1.0 : 0.0;

        // Weighted composite stress score
        // specs: behavior 20%, urgency 22%, bias 18%, finbert 15%, voice 5%, tone 20%
        const composite = (
            behaviorScore * 0.20 +
            urgencyScore * 0.22 +
            (activeBiases.length / 8) * 0.18 +
            finbertScore * 0.15 +
            voiceConfidence * 0.05 +
            toneScore * 0.20
        );

        // Map composite score + bias pattern to emotional state
        let state = 'neutral';
        let confidence = 0.5;

        if (composite >= 0.75 || activeBiases.includes('panic_selling')) {
            state = 'panic';
            confidence = 0.80 + (composite - 0.75) * 0.8;
        } else if (activeBiases.includes('fomo') || activeBiases.includes('overconfidence')) {
            state = composite > 0.5 ? 'fomo' : 'overconfidence';
            confidence = 0.65 + composite * 0.2;
        } else if (composite >= 0.55) {
            state = 'fear';
            confidence = 0.60 + (composite - 0.55) * 0.6;
        } else if (composite >= 0.35 || activeBiases.includes('debt_avoidance')) {
            state = 'anxiety';
            confidence = 0.55 + composite * 0.3;
        } else if (finbertLabel === 'positive' && composite < 0.25) {
            state = 'calm';
            confidence = 0.75;
        } else {
            state = 'neutral';
            confidence = 0.70;
        }

        // Clamp confidence to 0–1
        confidence = Math.min(Math.max(confidence, 0.0), 1.0);

        return {
            state,
            confidence,
            composite,
            activeBiases,
            toneResult,
            intervention: INTERVENTION_MAP[state] || INTERVENTION_MAP['neutral'],
        };
    }

    // ─────────────────────────────────────────────────────────
    //  7. GROQ GATE
    //  Decides whether to spend an API call or use local result
    // ─────────────────────────────────────────────────────────

    function shouldCallGroq(emotionResult, message, portfolioContext) {
        // ALWAYS call Groq for panic — too high stakes to skip
        if (emotionResult.state === 'panic') return { call: true, reason: 'panic_detected' };

        // Check cache first
        const cached = getCachedResponse(message);
        if (cached) return { call: false, reason: 'cache_hit', cached };

        // Skip trivial / very short messages
        if (message.trim().length < 15) return { call: false, reason: 'trivial_message' };

        // Skip pure greetings
        if (/^(hi|hello|hey|thanks|thank you|ok|okay|sure|yes|no)[\s!.?]*$/i.test(message.trim())) {
            return { call: false, reason: 'greeting' };
        }

        // High-stakes financial keywords → always call Groq
        if (HIGH_STAKES_REGEX.test(message)) return { call: true, reason: 'high_stakes_keywords' };

        // Large portfolio amount mentioned → always call
        if (portfolioContext && portfolioContext.netWorth > 100000) {
            if (/\b(sell|buy|invest|withdraw|move|switch|transfer)\b/i.test(message)) {
                return { call: true, reason: 'large_portfolio_action' };
            }
        }

        // Low confidence local estimate → escalate
        if (emotionResult.confidence < CONFIDENCE_THRESHOLD) {
            return { call: true, reason: 'low_local_confidence' };
        }

        // Confident enough locally → skip Groq
        return { call: false, reason: 'local_sufficient' };
    }

    // ─────────────────────────────────────────────────────────
    //  8. RESPONSE CACHE
    //  Stores Groq responses keyed by message fingerprint
    // ─────────────────────────────────────────────────────────

    function _cacheKey(message) {
        // Simple fingerprint: lowercase, strip punctuation, first 60 chars
        return message.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().slice(0, 60);
    }

    function getCachedResponse(message) {
        try {
            const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
            const key = _cacheKey(message);
            const entry = cache[key];
            if (!entry) return null;
            if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
                // Expired — clean up
                delete cache[key];
                localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
                return null;
            }
            return entry.response;
        } catch { return null; }
    }

    function setCachedResponse(message, response) {
        try {
            const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
            const key = _cacheKey(message);
            cache[key] = { response, timestamp: Date.now() };
            // Keep cache under 50 entries — evict oldest
            const keys = Object.keys(cache);
            if (keys.length > 50) {
                const oldest = keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp)[0];
                delete cache[oldest];
            }
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch { /* storage full — silently skip */ }
    }

    // ─────────────────────────────────────────────────────────
    //  9. SMART PROMPT BUILDER
    //  Compresses everything into ≤ 800 tokens for Groq
    // ─────────────────────────────────────────────────────────

    function buildPrompt({ message, emotionResult, portfolioContext, marketContext, userProfile }) {
        const { state, confidence, activeBiases, intervention } = emotionResult;

        // --- Emotional context block (~60 tokens) ---
        const emotionBlock = `
EMOTIONAL STATE DETECTED (do not reveal this to user):
State: ${state} (confidence: ${(confidence * 100).toFixed(0)}%)
Active biases: ${activeBiases.length > 0 ? activeBiases.join(', ') : 'none detected'}
Intervention type: ${intervention.type}
Response tone: ${intervention.tone}
Max sentences: ${intervention.maxSentences}
`.trim();

        // --- Portfolio context block (~100 tokens, compressed) ---
        let portfolioBlock = '';
        if (portfolioContext) {
            portfolioBlock = `
USER PORTFOLIO SNAPSHOT:
Net worth: ₹${(portfolioContext.netWorth || 0).toLocaleString('en-IN')}
Stress score: ${portfolioContext.stressScore || 'N/A'}/10
Key flags: ${(portfolioContext.flags || []).slice(0, 3).join(', ') || 'none'}
`.trim();
        }

        // --- Market context block (~100 tokens, compressed) ---
        let marketBlock = '';
        if (marketContext) {
            // Compress headlines to first headline only
            const headline = marketContext.headlines?.[0]?.title || '';
            const price = marketContext.price ? `${marketContext.ticker}: ₹${marketContext.price} (${marketContext.change}%)` : '';
            const sentiment = marketContext.bullishPct != null
                ? `Community: ${marketContext.bullishPct}% bullish`
                : '';
            marketBlock = `
MARKET CONTEXT:
${headline ? `Top headline: "${headline.slice(0, 80)}"` : ''}
${price}
${sentiment}
`.trim();
        }

        // --- User profile block (~50 tokens) ---
        let profileBlock = '';
        if (userProfile) {
            profileBlock = `
USER PROFILE:
Risk tolerance: ${userProfile.riskTolerance || 'moderate'}
Investment goal: ${(userProfile.goal || 'wealth building').slice(0, 50)}
Experience: ${userProfile.experience || 'beginner'}
`.trim();
        }

        // --- Intervention instruction block (~80 tokens) ---
        const interventionInstructions = {
            friction: `
INSTRUCTION: User is in PANIC state. 
- DO NOT give a direct sell/buy recommendation.
- Start with one empathetic sentence acknowledging their concern.
- Show one historical data point about recovery (e.g. 2020 crash recovery).
- End with one grounding question about their original investment goal.
- Never say "I understand" or "I hear you" — be concrete, not platitudinous.
`.trim(),
            reframe: `
INSTRUCTION: User is fearful.
- Reframe the situation with a longer time horizon.
- Provide one concrete fact that counters their fear.
- Do not dismiss their concern — acknowledge it briefly, then redirect.
`.trim(),
            reality_check: `
INSTRUCTION: User shows FOMO.
- Gently introduce base rates and downside scenarios.
- Show equal weight to risk as to potential upside.
- Suggest a smaller, test allocation rather than all-in.
`.trim(),
            risk_nudge: `
INSTRUCTION: User is overconfident.
- Introduce one specific risk they may not have considered.
- Use data, not opinion.
- Keep tone balanced — not alarmist.
`.trim(),
            simplify: `
INSTRUCTION: User is anxious.
- Break the answer into 2-3 simple, actionable steps.
- Use plain language. No financial jargon.
- End with the single most important thing to do TODAY.
`.trim(),
            protect: `
INSTRUCTION: User may be in a vulnerable emotional state.
- Prioritize their emotional wellbeing over financial optimization.
- Suggest speaking with a trusted person before making large decisions.
- Keep financial advice conservative and low-risk.
`.trim(),
            empower: `
INSTRUCTION: User is calm and rational.
- Provide comprehensive, data-driven advice.
- You may use financial terminology.
- Present multiple options with trade-offs.
`.trim(),
            none: `
INSTRUCTION: Standard helpful financial response.
- Be concise and accurate.
- Cite relevant data from context if available.
`.trim(),
        };

        const instruction = interventionInstructions[intervention.type] || interventionInstructions['none'];

        // Assemble full prompt — order matters for token efficiency
        const parts = [
            emotionBlock,
            portfolioBlock,
            marketBlock,
            profileBlock,
            instruction,
            `USER MESSAGE: "${message}"`,
        ].filter(Boolean);

        return parts.join('\n\n');
    }

    // ─────────────────────────────────────────────────────────
    //  10. FINBERT BRIDGE
    //  Calls your existing HuggingFace FinBERT integration
    //  Replace the body of this function with your actual call
    // ─────────────────────────────────────────────────────────

    async function runFinBERT(text) {
        try {
            const response = await fetch('/api/tone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await response.json();
            if (data.success) {
                return { label: data.sentiment, score: data.sentimentScore, biases: data.biases || [] };
            }
            return { label: 'neutral', score: 0.5, biases: [] };
        } catch {
            return { label: 'neutral', score: 0.5, biases: [] };
        }
    }

    // ─────────────────────────────────────────────────────────
    //  11. MAIN PUBLIC API
    //  Call this instead of calling Groq directly
    // ─────────────────────────────────────────────────────────

    /**
     * analyze()
     *
     * Main entry point. Call this on every user message BEFORE
     * your existing Groq call. It returns either:
     *   - { groqNeeded: false, localResponse: "..." }  → use localResponse, skip Groq
     *   - { groqNeeded: true,  prompt: "..." }          → send prompt to Groq instead of your old prompt
     *
     * @param {Object} params
     * @param {string}  params.message          - Raw user message text
     * @param {string}  params.hfApiKey         - HuggingFace API key (for FinBERT)
     * @param {Object}  params.portfolioContext - { netWorth, stressScore, flags[] }
     * @param {Object}  params.marketContext    - { headlines[], price, change, ticker, bullishPct }
     * @param {Object}  params.userProfile      - { riskTolerance, goal, experience }
     */
    async function analyze({
        message,
        hfApiKey = null,
        portfolioContext = null,
        marketContext = null,
        userProfile = null,
        toneResult = null,
    }) {

        // Ensure session is initialized
        if (!Session.data) Session.init();
        Session.recordMessage();

        // ── Step 1: Run all local scorers in parallel ──
        const [finbert, urgency, behavior, biases] = await Promise.all([
            runFinBERT(message, hfApiKey),
            Promise.resolve(scoreUrgency(message)),
            Promise.resolve(scoreBehavior(Session.get())),
            Promise.resolve(detectBiases(message)),
        ]);

        const mergedBiases = [...new Set([...biases, ...(finbert.biases || []).map(b => b.toLowerCase().replace(/ /g, '_'))])];

        // ── Step 2: Fuse into emotional state ──
        const emotionResult = fuseSignals({
            behaviorScore: behavior.score,
            urgencyScore: urgency.score,
            activeBiases: mergedBiases,
            finbertScore: finbert.score,
            finbertLabel: finbert.label,
            toneResult: toneResult,
        });

        // Attach raw signal detail for UI display
        emotionResult.signals = {
            behavioral: behavior.signals,
            urgency: urgency.triggers,
            finbert: finbert.label,
        };

        // ── Step 3: Gate — decide if Groq is needed ──
        const gate = shouldCallGroq(emotionResult, message, portfolioContext);

        if (!gate.call) {
            // Return a simple local response for low-stakes queries
            if (gate.reason === 'cache_hit') {
                return {
                    groqNeeded: false,
                    localResponse: gate.cached,
                    emotionResult,
                    source: 'cache',
                };
            }

            // For greetings / trivial messages — respond locally
            if (gate.reason === 'greeting' || gate.reason === 'trivial_message') {
                return {
                    groqNeeded: false,
                    localResponse: _localFallback(message, emotionResult),
                    emotionResult,
                    source: 'local_fallback',
                };
            }

            // Confident local state — still send to Groq but with compressed prompt
            // (Local sufficient means we're confident, but complex messages still need Groq)
            // For simple factual queries, return local fallback
            if (!HIGH_STAKES_REGEX.test(message) && message.length < 40) {
                return {
                    groqNeeded: false,
                    localResponse: _localFallback(message, emotionResult),
                    emotionResult,
                    source: 'local_sufficient',
                };
            }
        }

        // ── Step 4: Build compressed prompt for Groq ──
        const prompt = buildPrompt({
            message,
            emotionResult,
            portfolioContext,
            marketContext,
            userProfile,
        });

        return {
            groqNeeded: true,
            prompt,
            emotionResult,
            source: gate.reason,
            // Call this after you get Groq's response to cache it
            cacheResponse: (response) => setCachedResponse(message, response),
        };
    }

    // ─────────────────────────────────────────────────────────
    //  12. LOCAL FALLBACK RESPONSES
    //  Used when Groq is skipped — basic but emotion-aware
    // ─────────────────────────────────────────────────────────

    function _localFallback(message, emotionResult) {
        const { state } = emotionResult;
        const lower = message.toLowerCase();

        // Greeting responses
        if (/^(hi|hello|hey)\b/i.test(message.trim())) {
            return "Hello! I'm here to help with your financial questions. What's on your mind?";
        }

        // State-aware fallbacks for simple queries
        if (state === 'panic') {
            return "I can see you're concerned about your portfolio right now. Before making any major moves, take a breath — markets have recovered from every single historical downturn. What specifically are you worried about?";
        }
        if (state === 'fomo') {
            return "It's natural to feel like you're missing out when prices are moving fast. The best investors usually slow down when everyone else is rushing. What's the asset you're looking at?";
        }
        if (state === 'anxiety') {
            return "Financial stress is real, and it's okay to feel uncertain. Let's take this one step at a time. What's the single most pressing financial question you have right now?";
        }

        // Generic helpful fallback
        return "I'm analyzing your financial context. Could you give me a bit more detail about what you'd like help with?";
    }

    // ─────────────────────────────────────────────────────────
    //  13. UI HELPER — Emotion Badge
    //  Call this to render a small emotion indicator in your UI
    // ─────────────────────────────────────────────────────────

    function renderEmotionBadge(emotionResult, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const COLOR_MAP = {
            panic: '#e74c3c',
            fear: '#e67e22',
            fomo: '#f39c12',
            overconfidence: '#8e44ad',
            anxiety: '#d35400',
            grief: '#7f8c8d',
            calm: '#27ae60',
            neutral: '#3498db',
        };

        const EMOJI_MAP = {
            panic: '⚠',
            fear: '↓',
            fomo: '↑',
            overconfidence: '!',
            anxiety: '~',
            grief: '•',
            calm: '✓',
            neutral: '○',
        };

        const { state, confidence, activeBiases, toneResult } = emotionResult;
        const color = COLOR_MAP[state] || COLOR_MAP.neutral;
        const emoji = EMOJI_MAP[state] || '○';

        const domSignal = toneResult?.dominantSignal;
        const signalMap = { fast_speech: 'fast speech', tremor: 'voice tremor', high_pitch: 'high pitch', low_clarity: 'low clarity' };
        const voiceTag = domSignal && domSignal !== 'normal' ? ` · ${signalMap[domSignal]}` : '';

        container.innerHTML = `
      <div style="
        display: inline-flex; align-items: center; gap: 6px;
        padding: 4px 10px; border-radius: 20px;
        background: ${color}22; border: 1px solid ${color}55;
        font-size: 12px; font-family: inherit;
      ">
        <span style="color: ${color}; font-size: 14px">${emoji}</span>
        <span style="color: ${color}; font-weight: 600; text-transform: capitalize">${state}</span>
        <span style="color: ${color}88">${(confidence * 100).toFixed(0)}%</span>
        ${activeBiases.length > 0 ? `<span style="color: ${color}88">· ${activeBiases[0].replace(/_/g, ' ')}</span>` : ''}
        ${voiceTag ? `<span style="color: ${color}88">${voiceTag}</span>` : ''}
      </div>
    `;
    }

    // ─────────────────────────────────────────────────────────
    //  PUBLIC INTERFACE
    // ─────────────────────────────────────────────────────────

    return {
        // Core
        analyze,

        // Session management (call these from your app)
        initSession: () => Session.init(),
        recordClick: () => Session.recordClick(),
        recordPageVisit: (page) => Session.recordPageVisit(page),
        getSession: () => Session.get(),

        // UI
        renderEmotionBadge,

        // Utilities (exposed for testing)
        _internal: { scoreUrgency, scoreBehavior, detectBiases, fuseSignals, buildPrompt },
    };

})();

// ─────────────────────────────────────────────────────────
//  HOW TO USE IN YOUR index.html
// ─────────────────────────────────────────────────────────
//
//  1. Add this at the top of your sendMessage() function:
//
//     async function sendMessage() {
//       const message = document.getElementById('userInput').value;
//
//       const result = await EmotionEngine.analyze({
//         message,
//         hfApiKey:        apiKeys.huggingface,     // your existing key
//         portfolioContext: {
//           netWorth:    currentPortfolio.netWorth,
//           stressScore: currentPortfolio.stressScore,
//           flags:       currentPortfolio.flags,
//         },
//         marketContext: {
//           headlines:   latestNewsHeadlines,        // from your NewsAPI call
//           price:       latestPrice,                // from Alpha Vantage
//           change:      latestChange,
//           ticker:      detectedTicker,
//           bullishPct:  stockTwitsBullish,          // from StockTwits
//         },
//         userProfile: {
//           riskTolerance: userProfile.riskTolerance,
//           goal:          userProfile.investmentGoal,
//           experience:    userProfile.experience,
//         },
//       });
//
//       // Show emotion badge in UI
//       EmotionEngine.renderEmotionBadge(result.emotionResult, 'emotion-badge-container');
//
//       if (!result.groqNeeded) {
//         // Use local response directly — NO Groq call
//         displayMessage(result.localResponse, 'assistant');
//         return;
//       }
//
//       // Call Groq with the compressed, emotion-aware prompt
//       const groqResponse = await callGroq(result.prompt);   // your existing Groq function
//       result.cacheResponse(groqResponse);                   // cache it for next time
//       displayMessage(groqResponse, 'assistant');
//     }
//
//  2. Add click tracking anywhere in your app body:
//     document.addEventListener('click', () => EmotionEngine.recordClick());
//
//  3. Add page tracking when user navigates:
//     EmotionEngine.recordPageVisit('portfolio');  // or 'sell', 'news', etc.
//
//  4. Add this div in your chat UI for the emotion badge:
//     <div id="emotion-badge-container"></div>
//
//  5. Initialize on page load:
//     EmotionEngine.initSession();
//
// ─────────────────────────────────────────────────────────