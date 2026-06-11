# 🧠 FinMind — Behavioral Finance AI Advisor

**Live Web App:** [https://finmindai.vercel.app/](https://finmindai.vercel.app/)

FinMind is a modern, premium behavioral finance dashboard and AI advisor. Unlike generic financial apps, FinMind blends your portfolio numbers and real-time market data with your personal money psychology—analyzing tone, urgency, and cognitive biases to deliver deeply personalized, emotionally grounded financial guidance.

---

## 📂 Project Architecture

```
finance-agent/
├── 📁 api/                   # Serverless Functions (Backend API Endpoints)
│   ├── agent.js              # Advice prompt compiler & Groq LLM integration
│   ├── auth.js               # JWT Auth, registration & database connection manager
│   ├── dbFallback.js         # Mock MongoDB collections layer running locally
│   ├── market.js             # Financial prices, RSS news, and commodity handlers
│   ├── social.js             # Reddit feeds, StockTwits sentiment rating, and expert feeds
│   └── tone.js               # Sentiment text parser
├── 📁 js/                    # Frontend Module Scripts
│   ├── app.js                # Core controller, view router, and chat orchestration
│   ├── auth.js               # Auth requests, JWT storage, and state management
│   ├── agent.js              # Advice endpoint requester
│   ├── EmotionEngine.js      # Session scorer, bias evaluator, and Groq gating logic
│   ├── market.js             # Client market data hooks
│   ├── onboarding.js         # Onboarding wizard (financial profiles, risk scores)
│   ├── portfolio.js          # File uploader and statement parser
│   ├── social.js             # Client community and social feed hooks
│   ├── tone.js               # Text-based tone parser connector
│   └── toneAnalyzer.js       # Audio feature extractor (DSP & vocal metrics)
├── dev-server.js             # Local static files server & serverless endpoint proxy
├── index.html                # Single-page application root entrypoint
├── style.css                 # Premium custom design system and stylesheet
└── vercel.json               # Cloud Vercel routing configurations
```

---

## ⚙️ How Each Application Engine Works

### 1. 🧠 Advice & AI Orchestration Engine
*   **Files:** `api/agent.js`, `js/agent.js`
*   **Concept:** Blends multiple context layers (user portfolio, live market pricing, social metrics, detected biases, and vocal tone) into a dense, specialized prompt sent to large language models.
*   **Workflow:**
    1.  The client initiates a request by sending the user's prompt, past conversation history, portfolio summary, emotional state metrics, and live market updates.
    2.  The backend (`api/agent.js`) checks for a configured `GROQ_API_KEY`. If present, it compiles a system prompt directing the AI to speak in an empathetic "talking mode," citing specific numbers from the portfolio and current news headlines.
    3.  It runs parallel requests to `llama-3.3-70b-versatile` and `llama-3.1-8b-instant` with a 7-second abort controller timeout, ensuring speed and fallback safety.
    4.  If no API key is set, it automatically routes the request to a local rules engine (`generateFallbackAdvice`) that uses pre-defined templates to render tailored guidance based on the user's profile and stress score.

### 2. 🎭 Emotion & Cognitive Bias Detection Engine
*   **Files:** `js/EmotionEngine.js`, `api/tone.js`
*   **Concept:** A composite local-first analytics engine that monitors user activity, scores emotional urgency, detects biases, and decides whether an API call is necessary.
*   **Workflow:**
    1.  **Session Tracker:** Logs click timestamps (calculating clicks per minute), page switches, portfolio inspection frequency, late-night login hours, and consecutive days since the last visit.
    2.  **Urgency & Bias Detector:** Checks user text against regex patterns to identify 8 cognitive biases (FOMO, Loss Aversion, Overconfidence, Recency Bias, Anchoring, Panic Selling, Debt Avoidance, and Mental Accounting). It also calculates an urgency score based on capitalized words, punctuation, and panic vocabulary.
    3.  **Fission-Fusion Scoring:** Synthesizes multiple data points—comprising session behavior (20%), text urgency (22%), matched biases (18%), text sentiment (15%), voice presence (5%), and vocal pitch (20%)—into a combined stress level (`panic`, `fear`, `fomo`, `anxiety`, `calm`, `neutral`, `grief`).
    4.  **Groq API Gating:** To conserve API usage and protect key data, it intercepts requests. It returns cached or localized responses for simple greetings, and only escalates to Groq if a high-stakes transaction (e.g., >₹100,000 asset transfer) or panic state is detected.

### 3. 🎙️ Vocal Tone & Speech Analysis Engine
*   **Files:** `js/toneAnalyzer.js`, `js/meyda.min.js`
*   **Concept:** Real-time Digital Signal Processing (DSP) of audio streams to detect stress, pitch instabilities, and tremor in the user's voice.
*   **Workflow:**
    1.  Requests access to the user's microphone using Web Audio APIs.
    2.  Uses `Meyda.js` to process audio frames (buffer size: 1024) and extract spectral features:
        *   **RMS (Root Mean Square):** Audio amplitude representing speech energy.
        *   **ZCR (Zero Crossing Rate):** Frequency of sign-changes in the signal.
        *   **Spectral Centroid:** The center of gravity of the audio spectrum (pitch indicator).
        *   **Spectral Flatness:** Sound clarity, identifying noise vs. clear voiced speech.
    3.  On completion, it calculates the **speaking rate** (words per minute), **tremor** (RMS standard deviation), and **pitch variance**.
    4.  Calculates a composite tone score (0.0 to 1.0) and registers dominant audio signals (`fast_speech`, `tremor`, `high_pitch`, `low_clarity`) to inject into the Emotion Engine.

### 4. 📊 Portfolio Analytics & Stress Assessment Engine
*   **Files:** `js/portfolio.js`
*   **Concept:** Statement parsing and rules-based analysis of the user's asset holdings, liabilities, and income histories.
*   **Workflow:**
    1.  Reads uploaded portfolio `.json` files containing lists of assets, remaining loan principal, transaction dates, and past income streams.
    2.  Applies financial stress heuristics:
        *   **Debt-to-Asset Ratio:** Elevates stress score (+4) if total debt exceeds 50% of total assets.
        *   **High Sell Frequency:** Triggers stress flags (+2) if multiple asset sales occurred within short intervals.
        *   **Overdue Liabilities:** Checks if any lender principal is marked as overdue (+3).
    3.  Generates a summarized payload containing computed net worth, asset metrics, and income trend lines to serve as context for the AI Advisor.

### 5. 📈 Real-Time Market & Social Pipeline Engine
*   **Files:** `api/market.js`, `api/social.js`, `js/market.js`, `js/social.js`
*   **Concept:** Queries multiple public data sources to supply the dashboard and advisor with real-time financial and community insights.
*   **Workflow:**
    1.  Scans chat text to identify referenced assets (e.g., "BTC", "Gold", "Reliance").
    2.  **Price Fetching:** Queries current values and daily percentages for stocks, commodities, or cryptos.
    3.  **Financial RSS Feeds:** Crawls top financial news feeds to gather recent articles about the tracked asset.
    4.  **Reddit & Sentiment Crawler:** Aggregates posts from relevant communities, calculating upvote counts and overall bullish/bearish ratios to construct sentiment bars.

### 6. 💾 Adaptive Database & Auth Engine
*   **Files:** `api/auth.js`, `api/dbFallback.js`, `js/auth.js`
*   **Concept:** Zero-config account state management that works both in production and offline.
*   **Workflow:**
    1.  Handles user logins, account registrations, and password resets using bcrypt passwords and signed JWT tokens.
    2.  Attempts to establish a connection with MongoDB Atlas using the configured connection string.
    3.  If the connection string is absent or timed out, it switches the storage layer to a mocked MongoDB API (`dbFallback.js`).
    4.  The mock layer reads and writes to a local `users_db.json` file in the workspace, ensuring the app remains fully functional without a live database.
