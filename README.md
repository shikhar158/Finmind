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

## 🛠️ Tech Stack

*   **Frontend:** HTML5, Modern Vanilla CSS3, Module JS architecture
*   **Backend:** Node.js, Express, Vercel Serverless Functions
*   **AI Integration:** Groq API (Llama models), Hugging Face APIs
*   **Database:** MongoDB Atlas / Local JSON Mock Database

---

## 🌐 Deployment & Self-Hosting Guide

If you are hosting or deploying this application yourself, you will need to configure the following environment variables on your hosting provider (e.g., Vercel, Render, Heroku) or server:

### Environment Variables
Do **not** commit these variables or your `.env` file to GitHub. Instead, configure them in your hosting provider's settings panel:

| Variable | Description | Requirement |
| :--- | :--- | :--- |
| `JWT_SECRET` | Secret key used to sign JSON Web Tokens for user auth. | Required |
| `GROQ_API_KEY` | Your Groq Cloud API key to connect Llama AI models. | Optional (runs local rule-based fallback if empty) |
| `MONGODB_URI` | MongoDB Atlas database connection string. | Optional (runs local JSON database fallback `users_db.json` if empty) |

### Deploying to Vercel
1. Push this code to your GitHub repository.
2. Link your repository in Vercel.
3. Add `JWT_SECRET`, `GROQ_API_KEY`, and `MONGODB_URI` under **Settings** -> **Environment Variables** in the Vercel Dashboard.
4. Deploy!

---

## 💻 Local Development Setup (For Contributors)

If you want to clone this repository and run it locally for development:

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Local Environment**:
   Create a `.env` file in the root of the project:
   ```env
   PORT=3000
   JWT_SECRET=your_local_secret_key
   GROQ_API_KEY=your_groq_api_key
   MONGODB_URI=your_mongodb_connection_uri
   ```

3. **Start the dev server**:
   ```bash
   node dev-server.js
   ```
   Open [http://localhost:3000](http://localhost:3000) in your web browser.
