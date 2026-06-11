# 🧠 FinMind — Behavioral Finance AI Advisor

FinMind is a modern, premium behavioral finance dashboard and AI advisor. Unlike generic financial apps, FinMind blends your portfolio numbers and real-time market data with your personal money psychology—analyzing tone, urgency, and cognitive biases to deliver deeply personalized, emotionally grounded financial guidance.

---

## 🌟 Key Features

*   **🗣️ Conversational AI Advisor:** Leverages Groq Cloud (running Llama-3.3-70b-versatile and Llama-3.1-8b-instant models) to deliver wise, empathetic, and human-like advice.
*   **🎭 Cognitive Bias Detection:** Analyzes chat history and tone to identify common cognitive biases (e.g., *Loss Aversion*, *FOMO*, *Overconfidence*, *Herd Mentality*) and addresses them directly in the advice.
*   **🎤 Speech & Voice Integration:** Integrated voice recognition with customized Indian English accent support (`en-IN`), complete with a silence timer auto-submission.
*   **📊 Dynamic Portfolio Analytics:** Upload and analyze financial statements to measure total net worth, asset diversification, risk score, and real-time stress indicators.
*   **⚡ Real-Time Market & Social Pipeline:** Pulls live price tracking across Indian indices (Nifty, Sensex), US stocks (Google, Tesla, Apple), Crypto (Bitcoin, Ethereum), and Commodities (Gold, Silver), paired with live RSS financial news and Reddit community feeds.
*   **💾 Dual-Database Strategy:** Connects to MongoDB Atlas for cloud storage, with a seamless, zero-config local JSON file fallback (`users_db.json`) for instant offline execution.
*   **🎨 Premium Glassmorphic UI:** Sleek, animated interface with fully responsive CSS layouts, dark/light mode toggles, interactive past conversation history, and profile customization onboarding.

---

## 📂 Project Architecture

```
finance-agent/
├── 📁 api/                   # Serverless Functions (Backend Handlers)
│   ├── agent.js              # Advice prompt compiler & Groq integration
│   ├── auth.js               # JWT Auth & account management
│   ├── dbFallback.js         # Local JSON Mock database fallback
│   ├── market.js             # Financial prices & RSS news integration
│   └── social.js             # Reddit feed & sentiment aggregator
├── 📁 backend/               # Separate Express-Mongoose codebase setup
├── 📁 js/                    # Client-side Modules
│   ├── app.js                # Core controller, routers & views
│   ├── auth.js               # Auth requests & storage helpers
│   ├── agent.js              # Advice pipeline trigger
│   ├── EmotionEngine.js      # Gated local evaluation & HuggingFace pipeline
│   ├── market.js             # Client market hooks
│   └── toneAnalyzer.js       # Vocal and audio analysis
├── .env                      # App environment variables (ignored)
├── vercel.json               # Cloud Vercel routing configuration
├── dev-server.js             # Local static & endpoint Express proxy server
├── index.html                # Application root template
└── style.css                 # Premium custom design system styles
```

---

## 🚀 Getting Started

### 1. Installation
Clone the repository, navigate into the project directory, and install the dependencies:
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory and add your keys (FinMind runs fully featured fallbacks if these are omitted):
```env
PORT=3000
JWT_SECRET=your_super_secret_jwt_key

# Optional: Add Groq API Key to enable Llama LLM Advice
GROQ_API_KEY=your_groq_api_key_here

# Optional: Add MongoDB connection string (falls back to local users_db.json if blank)
MONGODB_URI=your_mongodb_atlas_connection_string
```

### 3. Run Locally
Start the local development server:
```bash
node dev-server.js
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🛠️ Tech Stack

*   **Frontend:** HTML5, Modern Vanilla CSS3, Module JS architecture
*   **Backend:** Node.js, Express, Vercel Serverless Functions
*   **AI Integration:** Groq API (Llama models), Hugging Face APIs
*   **Database:** MongoDB Atlas / Local JSON Mock Database
