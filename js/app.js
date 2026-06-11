// ============================================================
// app.js — Main App Controller & Chat Orchestration
// ============================================================

const App = (() => {
  let conversationHistory = [];
  let portfolioContext = null; // {parsedPortfolio, stressAnalysis, summary}
  let currentTone = null;
  let recognition = null;
  let isListening = false;
  let voiceSilenceTimer = null;

  // ===== View Router =====
  async function init() {
    EmotionEngine.initSession();
    document.addEventListener('click', () => EmotionEngine.recordClick());

    const savedTheme = localStorage.getItem('finmind_theme');
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

    if (!Auth.isLoggedIn()) {
      showLanding();
      return;
    }
    const user = await Auth.getCurrentUser();
    if (!user) {
      Auth.logout();
      showLanding();
      return;
    }
    if (!user.onboardingDone) {
      showOnboarding();
    } else {
      loadPortfolioContext(user);
      await showHomePrompt();
    }
  }

  function showLanding() {
    document.getElementById('app').innerHTML = `
      <div class="landing-page" style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; background: var(--bg-surface); position: relative; overflow-y: auto;">
        
        <!-- Top Nav -->
        <div style="position: absolute; top: 20px; left: 30px; font-family: 'Space Grotesk', sans-serif; font-size: 1.5rem; font-weight: 700; color: var(--text-1); display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.8rem;">🧠</span> FinMind
        </div>
        <button class="btn-ghost" style="position: absolute; top: 20px; right: 30px; font-size: 0.9rem; padding: 8px 16px;" onclick="App.showAuth()">Login</button>
        
        <!-- Hero Section -->
        <div style="max-width: 800px; text-align: center; margin-top: 60px;">
          <h1 style="font-size: 3.5rem; font-family: 'Space Grotesk', sans-serif; margin-bottom: 16px; color: var(--text-1); line-height: 1.1; font-weight: 700;">
            Your Behavioral Finance <span style="background: linear-gradient(120deg, var(--text-1), var(--text-3)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">AI</span>.
          </h1>
          <p style="color: var(--text-2); max-width: 600px; font-size: 1.1rem; margin: 0 auto 36px; line-height: 1.6;">
            FinMind doesn't just look at the numbers. It connects your money psychology with real-time analytics to provide deeply grounded financial guidance.
          </p>

          <!-- Button Container (Prevents Stretching) -->
          <div style="display: flex; justify-content: center; margin-bottom: 48px;">
            <button class="btn-primary" style="font-size: 1rem; padding: 14px 40px; border-radius: 99px; cursor: pointer; display: inline-block; width: auto;" onclick="App.showAuth()">
              Get Started Free ➤
            </button>
          </div>
        </div>

        <!-- Features Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; max-width: 900px; width: 100%; margin-top: 12px;">
          
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 16px; padding: 20px; text-align: left;">
            <div style="font-size: 1.5rem; margin-bottom: 8px;">📊</div>
            <div style="color: var(--text-1); font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Portfolio Analytics</div>
            <div style="color: var(--text-2); font-size: 0.82rem; line-height: 1.4;">Upload statements to evaluate assets, risks, and diversification instantly.</div>
          </div>

          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 16px; padding: 20px; text-align: left;">
            <div style="font-size: 1.5rem; margin-bottom: 8px;">🧠</div>
            <div style="color: var(--text-1); font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Behavioral Biases</div>
            <div style="color: var(--text-2); font-size: 0.82rem; line-height: 1.4;">FinMind evaluates your prompt text to label loss aversion, FOMO, or confidence fatigue.</div>
          </div>

          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 16px; padding: 20px; text-align: left;">
            <div style="font-size: 1.5rem; margin-bottom: 8px;">🌍</div>
            <div style="color: var(--text-1); font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Market Alignment</div>
            <div style="color: var(--text-2); font-size: 0.82rem; line-height: 1.4;">Aggregates current News, Reddit trending posts, expert feeds back into advice.</div>
          </div>

        </div>

      </div>
    `;
  }

  function showAuth() {
    document.getElementById('app').innerHTML = getAuthHTML();
    bindAuthEvents();
  }

  function showOnboarding() {
    document.getElementById('app').innerHTML = getOnboardingHTML();
    Onboarding.init();
  }

  async function showHomePrompt() {
    const user = await Auth.getCurrentUser();
    if (!user) return showLanding();
    document.getElementById('app').innerHTML = `
      <div class="chat-app">
        <header class="app-header">
          <div class="header-brand"><span class="brand-icon-sm">🧠</span> FinMind</div>
          <div class="header-tagline">Behavioral Finance AI</div>
          <div class="header-actions">
            <button class="icon-btn" id="theme-btn" title="Toggle Theme">🌓</button>
            <button class="icon-btn" id="profile-btn" title="View Profile">👤</button>
            <button class="icon-btn" id="logout-btn" title="Logout">🚪</button>
          </div>
        </header>

        <main style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 20px; background: var(--bg-surface);">
          <h2 style="font-size: 2rem; margin-bottom: 32px; font-weight: 500; color: var(--text-1); font-family: 'Space Grotesk', sans-serif;">What's on your mind, ${user.name}?</h2>
          
          <div class="chat-input-area" style="width: 100%; max-width: 700px; border-radius: 20px; border: 1px solid var(--border); background: var(--bg-glass); display: flex; align-items: flex-end; padding: 12px 16px; gap: 10px; margin-bottom: 24px; box-shadow: var(--shadow);">
            <textarea id="home-chat-input" placeholder='Ask anything — "Should I buy gold?" or "I lost my job, what do I do?"' rows="1" style="flex: 1; background: transparent; border: none; color: var(--text-1); font-size: 1rem; resize: none; min-height: 44px; padding: 10px 4px; font-family: 'Inter', sans-serif; outline: none;"></textarea>
            <button class="send-btn" id="home-send-btn" style="border-radius: 50%; width: 44px; height: 44px; padding: 0; display: flex; align-items: center; justify-content: center; margin-bottom:2px;">➤</button>
          </div>

          <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
            <button class="btn-ghost" onclick="document.getElementById('home-chat-input').value='How does my portfolio look?'; document.getElementById('home-send-btn').click();">📊 Evaluate Portfolio</button>
            <button class="btn-ghost" onclick="document.getElementById('home-chat-input').value='What are the latest market trends?'; document.getElementById('home-send-btn').click();">🌍 Market Trends</button>
            ${user.history && user.history.length > 0 ? `<button class="btn-ghost" onclick="App.showPastChats()">📜 View Past Chats</button>` : ''}
          </div>
        </main>
        
        ${getModalsHTML()}
      </div>
    `;

    bindHeaderEvents();

    const input = document.getElementById('home-chat-input');
    const sendBtn = document.getElementById('home-send-btn');

    input.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight) + 'px';
      if (this.scrollHeight > 150) this.style.overflowY = 'auto';
      else this.style.overflowY = 'hidden';
    });

    sendBtn.addEventListener('click', () => {
      const text = input.value.trim();
      if (text) showChat(text);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });
  }

  async function showPastChats() {
    const user = await Auth.getCurrentUser();
    const history = user?.history || [];
    
    let pairs = [];
    for (let i = 0; i < history.length; i++) {
      if (history[i].role === 'user') {
        let q = history[i].content;
        let a = "Waiting for answer...";
        if (history[i + 1] && history[i + 1].role === 'assistant') {
          a = history[i + 1].content;
        }
        pairs.push({ q, a });
      }
    }
    
    pairs = pairs.reverse();

    const itemsHTML = pairs.length > 0 
      ? pairs.map((p, idx) => `
          <div class="past-chat-card" style="margin-bottom: 20px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow);">
            <div class="pc-question" style="padding: 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid transparent; transition: all 0.2s;" onclick="this.nextElementSibling.classList.toggle('hidden'); this.style.borderBottomColor = this.nextElementSibling.classList.contains('hidden') ? 'transparent' : 'var(--border)'; this.querySelector('.pc-chevron').style.transform = this.nextElementSibling.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';">
              <span style="font-weight: 600; font-size: 1.1rem; color: var(--text-1); flex:1; padding-right:16px;">💬 ${p.q}</span>
              <span class="pc-chevron" style="color: var(--text-2); font-size: 1.2rem; transition: transform 0.2s;">▼</span>
            </div>
            <div class="pc-answer hidden" style="padding: 20px; background: var(--bg-glass); border-top: 1px solid var(--border); color: var(--text-2); line-height: 1.6; font-size: 0.95rem;">
              ${formatMessage(p.a)}
            </div>
          </div>
        `).join('')
      : '<div style="text-align: center; color: var(--text-2); padding: 40px; background: var(--bg-surface); border-radius: 16px; border: 1px dashed var(--border);">No past chats yet. Ask a question to get started!</div>';

    document.getElementById('app').innerHTML = `
      <div class="app-layout" style="display: flex; flex-direction: column; height: 100vh; overflow-y: auto; background: var(--bg-base);">
        <header class="app-header" style="padding: 16px 24px; background: var(--bg-surface); border-bottom: 1px solid var(--border); display: flex; align-items: center;">
          <div class="header-brand"><span class="brand-icon-sm">🧠</span> FinMind</div>
          <button class="icon-btn" onclick="App.init()" title="Back to Home" style="margin-left: auto; display: flex; align-items: center; gap: 8px; font-size: 0.95rem; font-weight: 500; padding: 8px 16px; border-radius: 20px; border: 1px solid var(--border); background: var(--bg-glass); color: var(--text-1); cursor: pointer;">
            🏠 Back to Home
          </button>
        </header>
        
        <main style="flex:1; max-width: 900px; margin: 0 auto; width: 100%; padding: 40px 20px;">
          <h2 style="font-size: 2.2rem; margin-bottom: 10px; font-family: 'Space Grotesk', sans-serif; color: var(--text-1);">Your Conversation History</h2>
          <p style="color: var(--text-2); margin-bottom: 32px; font-size: 1.05rem;">Review all the questions and answers you've discussed with FinMind.</p>
          
          <div class="past-chats-container">
            ${itemsHTML}
          </div>
        </main>
      </div>
    `;
  }

  async function showChat(initialMessage = null) {
    const user = await Auth.getCurrentUser();
    loadPortfolioContext(user);
    document.getElementById('app').innerHTML = getChatHTML(user);
    bindChatEvents();

    // Load persisted history
    conversationHistory = user.history || [];

    updateProfileSidebar();

    // Render initial messages
    const chat = document.getElementById('chat-messages');
    if (chat) {
      chat.innerHTML = '';
      appendMessage('assistant', getWelcomeMessage(user));
      conversationHistory.forEach(msg => {
        appendMessage(msg.role, msg.content, msg.type || '');
      });
    }

    updatePastQueries();

    if (initialMessage) {
      const input = document.getElementById('chat-input');
      if (input) {
        input.value = initialMessage;
        sendMessage();
      }
    }
  }

  function loadPortfolioContext(user) {
    if (user?.portfolio) {
      const parsed = user.portfolio;
      const stress = user.stressAnalysis || Portfolio.analyzeStress(parsed);
      const summary = Portfolio.summarizeForAgent(parsed, stress);
      portfolioContext = { parsed, stress, summary };
    } else {
      portfolioContext = {
        parsed: null, stress: { stressScore: 0, flags: [] },
        summary: {
          holdingsSummary: 'Not uploaded',
          transactionsSummary: 'Not uploaded',
          incomeSummary: 'Not provided',
          netWorth: 0,
          stressScore: 0,
          stressFlags: [],
          profile: {},
        },
      };
    }
  }

  function getWelcomeMessage(user) {
    const stress = portfolioContext?.stress;
    if (stress?.stressScore >= 7) {
      return `👋 Welcome back, ${user.name}. I can see from your portfolio that you've been through some financial turbulence recently — **income disruption detected**. I want you to know that's completely manageable with the right plan. I'm here to help. What's on your mind today?`;
    }
    return `👋 Welcome back, ${user.name}! I'm FinMind, your behavioral finance advisor. I have your portfolio loaded and I'm connected to live news, market prices, Reddit, and expert advisor insights. Ask me anything — *"Should I buy gold?"*, *"Is now a good time to invest?"*, or just tell me how you're feeling about your finances.`;
  }

  // ===== Chat Engine =====
  function bindHeaderEvents() {
    document.getElementById('home-btn')?.addEventListener('click', () => { setTimeout(showHomePrompt, 0); });

    document.getElementById('theme-btn')?.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      document.documentElement.setAttribute('data-theme', isLight ? 'dark' : 'light');
      localStorage.setItem('finmind_theme', isLight ? 'dark' : 'light');
    });
    document.getElementById('profile-btn')?.addEventListener('click', showProfileModal);
    document.getElementById('profile-close')?.addEventListener('click', () => {
      document.getElementById('profile-modal')?.classList.add('hidden');
    });
    document.getElementById('modal-edit-btn')?.addEventListener('click', () => {
      document.getElementById('profile-modal')?.classList.add('hidden');
      Onboarding.startEdit();
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => { Auth.logout(); init(); });
  }

  function bindChatEvents() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const micBtn = document.getElementById('mic-btn');

    // --- Speech Recognition Support ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && micBtn) {
      micBtn.style.display = 'block';
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Enable better Indian accent support!

      recognition.onstart = () => {
        isListening = true;
        micBtn.classList.add('active');
        resetSilenceTimer();
      };

      recognition.onresult = (event) => {
        resetSilenceTimer();
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
            if (typeof VoiceAnalyzer !== 'undefined') VoiceAnalyzer.countWord();
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (input) {
          const currentText = finalTranscript || interimTranscript;
          if (currentText) input.value = currentText;
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          showToast('Microphone access denied');
        }
        stopListening();
      };

      recognition.onend = async () => {
        isListening = false;
        micBtn.classList.remove('active');
        clearTimeout(voiceSilenceTimer);

        if (typeof VoiceAnalyzer !== 'undefined') {
          const toneResult = VoiceAnalyzer.stop();
          if (input && input.value.trim()) {
            sendMessage(toneResult); // Auto-submit with result!
          }
        }
      };

      micBtn.addEventListener('click', () => {
        try {
          if (micBtn.classList.contains('active')) {
            micBtn.classList.remove('active');
            isListening = false;
            if (recognition) recognition.stop();
          } else {
            micBtn.classList.add('active'); // Instant pulse feedback Node setups
            startListening();
          }
        } catch (err) {
          console.error('Mic toggle error:', err);
          micBtn.classList.remove('active');
          isListening = false;
        }
      });
    } else {
      console.warn('SpeechRecognition API not supported or disabled in this browser.');
    }

    function resetSilenceTimer() {
      clearTimeout(voiceSilenceTimer);
      voiceSilenceTimer = setTimeout(() => {
        stopListening();
      }, 10000); // 10s wait before auto-submitting
    }

    async function startListening() {
      if (recognition) {
        try {
          if (typeof VoiceAnalyzer !== 'undefined') {
            await VoiceAnalyzer.start();
          }
          recognition.start();
        } catch (err) {
          console.error('Mic initialization failed:', err);
          showToast('Microphone failed: ' + (err.message || 'Unknown error'));
          stopListening();
        }
      }
    }


    function stopListening() {
      if (recognition) recognition.stop();
    }

    function showToast(msg) {
      const toast = document.createElement('div');
      toast.style = "position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:rgba(239,68,68,0.85); color:white; padding:10px 20px; border-radius:8px; font-size:0.85rem; z-index:1000;";
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    input?.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight) + 'px';
      if (this.scrollHeight > 150) this.style.overflowY = 'auto';
      else this.style.overflowY = 'hidden';
    });

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
      });
    }

    bindHeaderEvents();
  }

  async function sendMessage(toneResult = null) {
    const input = document.getElementById('chat-input');
    const text = input?.value?.trim();
    if (!text) return;
    input.value = '';

    appendMessage('user', text);
    conversationHistory.push({ role: 'user', content: text });
    await Auth.updateUser({ history: conversationHistory });
    updatePastQueries();

    const typingId = showTyping();
    const user = await Auth.getCurrentUser();

    try {
      const country = user?.profile?.country || 'Global';
      const holdings = user?.portfolio?.items || [];

      // Run all three pipeline stages in parallel
      const [tone, market, social] = await Promise.all([
        ToneAnalyzer.analyze(text),
        MarketData.getMarketContext(text, country, holdings),
        SocialData.getCommunityContext(text, MarketData.extractAsset(text)?.symbol),
      ]);

      currentTone = tone;
      updateProfileSidebar(tone); // Initial updates
      updateMarketPanel(market, social);
      const fullSummary = {
        ...(portfolioContext?.summary || {}),
        profile: user?.portfolio?.profile || {},
      };

      // EmotionEngine analytics and gating
      const emotionResult = await EmotionEngine.analyze({
        message: text,
        hfApiKey: localStorage.getItem('finmind_hf_key'),
        portfolioContext: {
          netWorth: fullSummary.netWorth || 0,
          stressScore: fullSummary.stressScore || 0,
          flags: fullSummary.stressFlags || [],
        },
        marketContext: {
          headlines: market.news || [],
          price: market.price?.price,
          change: market.price?.change,
          ticker: market.price?.asset,
          bullishPct: social.stocktwits?.bullish,
        },
        userProfile: {
          riskTolerance: user.profile?.riskScore >= 7 ? 'aggressive' : user.profile?.riskScore >= 4 ? 'moderate' : 'conservative',
          goal: (user.profile?.goals || []).join(', '),
          experience: user.profile?.experience || 'beginner',
        },
        toneResult: toneResult // Pass it through!
      });

      // Render emotion badge in UI
      if (emotionResult.emotionResult) {
        EmotionEngine.renderEmotionBadge(emotionResult.emotionResult, 'emotion-badge-container');
        updateProfileSidebar(tone, emotionResult.emotionResult); // <--- Added to pass biases!
      }

      let response = '';
      if (!emotionResult.groqNeeded) {
        response = emotionResult.localResponse;
      } else {
        response = await Agent.getAdvice(
          text, conversationHistory.slice(-8),
          user, fullSummary, tone, market, social,
          emotionResult.prompt
        );
        if (emotionResult.cacheResponse) emotionResult.cacheResponse(response);
      }

      removeTyping(typingId);
      appendMessage('assistant', response);
      conversationHistory.push({ role: 'assistant', content: response });
      await Auth.updateUser({ history: conversationHistory });
      updatePastQueries();

    } catch (err) {
      removeTyping(typingId);
      appendMessage('assistant', `⚠️ ${err.message}`, 'error');
    }
  }

  // ===== UI Helpers =====
  function appendMessage(role, content, type = '') {
    const chat = document.getElementById('chat-messages');
    if (!chat) return;
    const div = document.createElement('div');
    div.className = `message ${role} ${type}`;
    div.innerHTML = `
      <div class="msg-avatar">${role === 'user' ? '👤' : '🧠'}</div>
      <div class="msg-bubble">${formatMessage(content)}</div>
    `;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    // Animate in
    requestAnimationFrame(() => div.classList.add('visible'));
  }

  function formatMessage(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function showTyping() {
    const chat = document.getElementById('chat-messages');
    if (!chat) return null;
    const uid = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.className = 'message assistant typing-indicator';
    div.id = uid;
    div.innerHTML = `
      <div class="msg-avatar">🧠</div>
      <div class="msg-bubble thinking-bubble">
        <span class="thinking-label">Thinking</span>
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>`;
    chat.appendChild(div);
    // Make visible immediately (unlike regular messages which animate in)
    requestAnimationFrame(() => div.classList.add('visible'));
    chat.scrollTop = chat.scrollHeight;
    return uid;
  }

  function removeTyping(id) {
    document.getElementById(id)?.remove();
  }

  function updatePastQueries() {
    const list = document.getElementById('past-queries-list');
    if (!list) return;

    let pairs = [];
    for (let i = 0; i < conversationHistory.length; i++) {
      if (conversationHistory[i].role === 'user') {
        let q = conversationHistory[i].content;
        let a = "Waiting for answer...";
        if (conversationHistory[i + 1] && conversationHistory[i + 1].role === 'assistant') {
          a = conversationHistory[i + 1].content;
        }
        pairs.push({ q, a });
      }
    }

    if (pairs.length === 0) {
      list.innerHTML = '<div class="no-data">No history yet</div>';
      return;
    }

    list.innerHTML = pairs.reverse().map((p, i) => `
      <details class="history-accordion">
        <summary>💬 "${p.q.length > 50 ? p.q.substring(0, 50) + '...' : p.q}"</summary>
        <div class="history-answer">${formatMessage(p.a)}</div>
      </details>
    `).join('');
  }

  async function updateProfileSidebar(tone, emotionResult = null) {
    const user = await Auth.getCurrentUser();
    const stress = portfolioContext?.stress;
    const summary = portfolioContext?.summary;

    // Sentiment ring color
    const ring = document.getElementById('sentiment-ring');
    if (ring && tone) {
      ring.className = 'sentiment-ring ' + tone.sentiment;
      ring.querySelector('.ring-label').textContent = tone.emotion || '—';
      ring.querySelector('.ring-score').textContent = tone ? `${Math.round(tone.sentimentScore * 100)}%` : '';
    }

    // Stress badge
    const stressBadge = document.getElementById('stress-badge');
    if (stressBadge && stress) {
      const level = stress.stressScore >= 7 ? 'high' : stress.stressScore >= 4 ? 'med' : 'low';
      stressBadge.className = `stress-badge stress-${level}`;
      stressBadge.textContent = `Stress: ${stress.stressScore}/10`;
    }

    // Biases
    const biasContainer = document.getElementById('bias-tags');
    const activeBiases = emotionResult?.activeBiases || [];
    const toneBiases = (tone?.biases || []).map(b => b.toLowerCase().replace(/ /g, '_'));
    const biases = [...new Set([...activeBiases, ...toneBiases])];
    if (biasContainer) {
      biasContainer.innerHTML = biases.length
        ? biases.map(b => `<span class="bias-tag">${b.replace(/_/g, ' ')}</span>`).join('')
        : '<span class="no-bias">No biases detected</span>';
    }

    // Urgency
    const urgencyEl = document.getElementById('urgency-indicator');
    if (urgencyEl && tone) {
      urgencyEl.className = `urgency urgency-${tone.urgency?.toLowerCase()}`;
      urgencyEl.textContent = `Urgency: ${tone.urgency || '—'}`;
    }

    // Net worth + flags
    const nwEl = document.getElementById('net-worth-display');
    if (nwEl && summary) {
      nwEl.textContent = summary.netWorth ? `₹${summary.netWorth.toLocaleString()}` : '—';
    }

    const flagsEl = document.getElementById('stress-flags');
    if (flagsEl && stress?.flags) {
      flagsEl.innerHTML = stress.flags.slice(0, 3)
        .map(f => `<div class="stress-flag">${f}</div>`).join('') || '';
    }

    // Freshness Banner
    const freshnessEl = document.getElementById('freshness-banner-container');
    if (freshnessEl) {
      const lastUpdated = summary?.profile?.last_updated;
      let titleStr = "Unknown Freshness";
      let freshnessColor = 'var(--text-2)';
      let daysOldObj = null;

      if (lastUpdated) {
        const daysOld = Math.floor((new Date() - new Date(lastUpdated)) / (1000 * 60 * 60 * 24));
        daysOldObj = daysOld;
        freshnessColor = daysOld > 30 ? 'var(--red)' : daysOld > 7 ? 'var(--orange)' : 'var(--green)';
        titleStr = daysOld === 0 ? 'Fresh Today' : `${daysOld} Days Ago`;
      }
      
      freshnessEl.innerHTML = `
        <div style="margin-top: 12px; border: 1px solid ${freshnessColor}; border-left: 3px solid ${freshnessColor}; padding: 8px; border-radius: 6px; font-size: 0.75rem; color: var(--text-2); background: rgba(255,255,255,0.02);">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="font-size: 1rem;">${lastUpdated && daysOldObj <= 7 ? '✅' : '⏱️'}</span>
            <strong style="color: var(--text-1); font-size: 0.8rem;">${titleStr}</strong>
          </div>
          ${lastUpdated ? `Snapshot: ${lastUpdated}` : 'Snapshot timestamp missing.'}
        </div>
      `;
    }
  }

  function updateMarketPanel(market, social) {
    // Price chip
    const priceEl = document.getElementById('market-price');
    if (priceEl) {
      if (market.price) {
        const changeClass = parseFloat(market.price.change) >= 0 ? 'up' : 'down';
        priceEl.innerHTML = `
          <div class="asset-name">${market.price.asset}</div>
          <div class="price-value">${market.price.currency} ${market.price.price}</div>
          ${market.price.change ? `<div class="price-change ${changeClass}">${market.price.change > 0 ? '▲' : '▼'} ${Math.abs(market.price.change)}%</div>` : ''}
        `;
      } else {
        priceEl.innerHTML = '<div class="no-data">Ask about a specific asset for live price</div>';
      }
    }

    // News
    const newsEl = document.getElementById('market-news');
    if (newsEl) {
      newsEl.innerHTML = market.news?.length
        ? market.news.map(n => `
            <a href="${n.url}" target="_blank" class="news-card">
              <span class="news-source">${n.source}</span>
              <span class="news-title">${n.title}</span>
            </a>`).join('')
        : '<div class="no-data">No news fetched for this query</div>';
    }

    // StockTwits -> Now Reddit Sentiment
    const stEl = document.getElementById('stocktwits-sentiment');
    if (stEl && social?.stocktwits) {
      const { bullish, bearish } = social.stocktwits;
      const total = bullish + bearish;
      stEl.innerHTML = `
        <div class="st-label" style="display:flex; justify-content:space-between;"><span>📱 Reddit Sentiment</span></div>
        ${total > 0 ? `
        <div class="st-bar">
          <div class="st-bull" style="width:${Math.round(bullish / total * 100)}%">🐂 ${bullish}</div>
          <div class="st-bear" style="width:${Math.round(bearish / total * 100)}%">🐻 ${bearish}</div>
        </div>` : '<div style="font-size:0.75rem; color:var(--text-3); margin-top:4px;">No rating matches for query</div>'}
      `;
    }

    // Reddit
    const redditEl = document.getElementById('reddit-posts');
    if (redditEl && social?.reddit?.length) {
      redditEl.innerHTML = `<div class="panel-sublabel">📱 Community</div>` +
        social.reddit.slice(0, 3).map(r => `
          <a href="${r.url}" target="_blank" class="reddit-card">
            <span class="reddit-sub">${r.subreddit}</span>
            <span class="reddit-title">${r.title}</span>
            <span class="reddit-score">↑${r.score}</span>
          </a>`).join('');
    }

    // Expert feeds
    const expertEl = document.getElementById('expert-posts');
    if (expertEl && social?.expertPosts?.length) {
      expertEl.innerHTML = `<div class="panel-sublabel">🎙️ Expert Insights</div>` +
        social.expertPosts.slice(0, 3).map(e => `
          <a href="${e.link}" target="_blank" class="expert-card">
            <span class="expert-name">${e.expert.split('(')[0].trim()}</span>
            <span class="expert-title">${e.title}</span>
          </a>`).join('');
    }
  }

  // ===== Auth HTML & Events =====
  function getAuthHTML() {
    return `
      <div class="auth-screen">
        <div class="auth-brand">
          <div class="brand-icon">🧠</div>
          <h1>FinMind</h1>
          <p>Behavioral Finance AI Advisor</p>
        </div>
        <div class="auth-card-container">
          <div class="auth-card" id="auth-card">
            <div class="auth-front">
              <h2>Welcome Back</h2>
              <div class="form-group"><label>Email</label><input type="email" id="login-email" placeholder="you@example.com"></div>
              <div class="form-group"><label>Password</label><input type="password" id="login-password" placeholder="••••••••"></div>
              <div style="text-align: right; margin-bottom: 15px;"><a href="#" id="show-forgot" style="font-size: 0.85rem; color: var(--text-2);">Forgot Password?</a></div>
              <button class="btn-primary" id="login-btn">Login</button>
              <div id="login-error" class="auth-error"></div>
              <p class="auth-switch">Don't have an account? <a href="#" id="show-register">Register</a></p>
            </div>
            <div class="auth-back">
              <h2>Create Account</h2>
              <div class="form-group"><label>Full Name</label><input type="text" id="reg-name" placeholder="Arjun Mehta"></div>
              <div class="form-group"><label>Email</label><input type="email" id="reg-email" placeholder="you@example.com"></div>
              <div class="form-group"><label>Password</label><input type="password" id="reg-password" placeholder="Min 6 characters"></div>
              <button class="btn-primary" id="register-btn">Create Account</button>
              <div id="reg-error" class="auth-error"></div>
              <p class="auth-switch">Already have an account? <a href="#" id="show-login">Login</a></p>
            </div>
          </div>
          <div class="auth-forgot hidden" id="forgot-card" style="position:absolute; inset:0; background:var(--bg-surface); border-radius:16px; z-index:10; padding:40px; display:flex; flex-direction:column; justify-content:center; text-align:left;">
            <h2>Reset Password</h2>
            <div class="form-group"><label>Account Email</label><input type="email" id="forgot-email" placeholder="you@example.com"></div>
            <div class="form-group"><label>Full Name used for account</label><input type="text" id="forgot-name" placeholder="John Doe"></div>
            <div class="form-group"><label>New Password</label><input type="password" id="forgot-password" placeholder="Min 6 characters"></div>
            <button class="btn-primary" id="reset-btn">Reset Password</button>
            <div id="forgot-error" class="auth-error"></div>
            <p class="auth-switch">Remembered your password? <a href="#" id="show-login-from-forgot">Back to Login</a></p>
          </div>
        </div>
      </div>`;
  }

  function bindAuthEvents() {
    document.getElementById('login-btn')?.addEventListener('click', async () => {
      const email = document.getElementById('login-email')?.value?.trim();
      const password = document.getElementById('login-password')?.value;
      const result = await Auth.login(email, password);
      if (result.success) { init(); }
      else { document.getElementById('login-error').textContent = result.error; }
    });

    document.getElementById('register-btn')?.addEventListener('click', async () => {
      const name = document.getElementById('reg-name')?.value?.trim();
      const email = document.getElementById('reg-email')?.value?.trim();
      const password = document.getElementById('reg-password')?.value;
      if (password.length < 6) { document.getElementById('reg-error').textContent = 'Password must be at least 6 characters.'; return; }
      const result = await Auth.register(name, email, password);
      if (result.success) { init(); }
      else { document.getElementById('reg-error').textContent = result.error; }
    });

    document.getElementById('show-register')?.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('auth-card')?.classList.add('flipped');
    });

    document.getElementById('show-login')?.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('auth-card')?.classList.remove('flipped');
    });

    document.getElementById('show-forgot')?.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('forgot-card')?.classList.remove('hidden');
    });

    document.getElementById('show-login-from-forgot')?.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('forgot-card')?.classList.add('hidden');
    });

    document.getElementById('reset-btn')?.addEventListener('click', async () => {
      const email = document.getElementById('forgot-email')?.value?.trim();
      const name = document.getElementById('forgot-name')?.value?.trim();
      const newPassword = document.getElementById('forgot-password')?.value;
      if (!email || !name || !newPassword) {
        document.getElementById('forgot-error').textContent = 'All fields are required.';
        return;
      }
      if (newPassword.length < 6) {
        document.getElementById('forgot-error').textContent = 'Password must be at least 6 characters.';
        return;
      }
      const result = await Auth.forgotPassword(email, name, newPassword);
      if (result.success) {
        document.getElementById('forgot-error').style.color = 'var(--green)';
        document.getElementById('forgot-error').textContent = 'Password reset successful! Please log in.';
        setTimeout(() => {
          document.getElementById('forgot-card')?.classList.add('hidden');
          document.getElementById('forgot-error').textContent = '';
          document.getElementById('forgot-error').style.color = '';
        }, 2000);
      } else {
        document.getElementById('forgot-error').style.color = 'var(--red)';
        document.getElementById('forgot-error').textContent = result.error;
      }
    });
  }

  // ===== Onboarding HTML =====
  function getOnboardingHTML() {
    return `
      <div class="onboarding-screen">
        <div class="ob-header">
          <div class="brand-small">🧠 FinMind</div>
          <div class="ob-progress-wrap">
            <div class="ob-progress-bg"><div id="ob-progress-bar" class="ob-progress-fill"></div></div>
            <span id="ob-step-label">Step 1 of 5</span>
          </div>
        </div>
        <div class="ob-body">
          <div id="onboarding-container"></div>
        </div>
        <div class="ob-footer">
          <button class="btn-ghost" id="ob-prev">← Back</button>
          <button class="btn-primary" id="ob-next">Continue →</button>
        </div>
      </div>`;
  }

  // ===== Chat HTML =====
  function getChatHTML(user) {
    return `
      <style>
        .mic-btn.active {
          background: rgba(139, 92, 246, 0.2) !important;
          border-color: #8b5cf6 !important;
          color: #fff !important;
          animation: purplePulse 1.5s infinite;
        }
        @keyframes purplePulse {
          0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.6); }
          70% { box-shadow: 0 0 0 10px rgba(139, 92, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
        }
      </style>
      <div class="chat-app">
        <!-- Header -->
        <header class="app-header">
          <div class="header-brand"><span class="brand-icon-sm">🧠</span> FinMind</div>
          <div class="header-tagline">Behavioral Finance AI</div>
          <div class="header-actions">
            <button class="icon-btn" id="home-btn" title="New Chat">🏠</button>
            <button class="icon-btn" id="theme-btn" title="Toggle Theme">🌓</button>
            <button class="icon-btn" id="profile-btn" title="View Profile">👤</button>
            <button class="icon-btn" id="logout-btn" title="Logout">🚪</button>
          </div>
        </header>

        <!-- Main 3-column layout -->
        <main class="chat-layout">

          <!-- LEFT: Behavioral Profile -->
          <aside class="sidebar-left">
            <div class="sidebar-section">
              <div class="section-title">Behavioral Profile</div>
              <div class="sentiment-ring neutral" id="sentiment-ring">
                <div class="ring-inner">
                  <div class="ring-label">—</div>
                  <div class="ring-score"></div>
                </div>
              </div>
              <div id="urgency-indicator" class="urgency urgency-low">Urgency: —</div>
              <div id="emotion-badge-container" style="margin-top: 12px;"></div>
            </div>

            <div class="sidebar-section">
              <div class="section-title">Active Biases</div>
              <div id="bias-tags" class="bias-tags">
                <span class="no-bias">Send a message to detect</span>
              </div>
            </div>

            <div class="sidebar-section">
              <div class="section-title">Financial Health</div>
              <div id="stress-badge" class="stress-badge stress-low">Stress: —/10</div>
              <div class="portfolio-mini">
                <div class="pm-row"><span>Net Worth</span><strong id="net-worth-display">${portfolioContext?.summary?.netWorth ? '₹' + portfolioContext.summary.netWorth.toLocaleString() : '—'}</strong></div>
              </div>
              <div id="stress-flags" class="stress-flags-mini"></div>
              <div id="freshness-banner-container"></div>
            </div>


          </aside>

          <!-- CENTER: Chat -->
          <section class="chat-section">
            <div class="chat-messages" id="chat-messages"></div>
            <div id="retry-notice" class="retry-notice hidden"></div>
            <div class="chat-input-area">
              <textarea id="chat-input" placeholder='Ask anything — "Should I buy gold?" or "I lost my job, what do I do?"' rows="2"></textarea>
              <button class="icon-btn mic-btn" id="mic-btn" title="Speak to advisor" style="display: none; font-size: 1.1rem; padding: 10px; margin-left: 4px;">🎙️</button>
              <button class="send-btn" id="send-btn" style="margin-left: 4px;">
                <span>Send</span> ➤
              </button>
            </div>
          </section>

          <!-- RIGHT: Market & Community Panel -->
          <aside class="sidebar-right">
            <div class="sidebar-section">
              <div class="section-title">Live Market</div>
              <div id="market-price" class="market-price-chip">
                <div class="no-data">Ask about an asset for live data</div>
              </div>
            </div>

            <div class="sidebar-section">
              <div class="section-title">News Headlines</div>
              <div id="market-news" class="news-feed">
                <div class="no-data">—</div>
              </div>
            </div>

            <div class="sidebar-section">
              <div id="stocktwits-sentiment"></div>
              <div id="reddit-posts" class="reddit-feed"></div>
            </div>

            <div class="sidebar-section">
              <div id="expert-posts" class="expert-feed"></div>
            </div>
          </aside>
        </main>

        ${getModalsHTML()}
      </div>
    `;
  }

  function getModalsHTML() {
    return `
        <!-- Profile Modal -->
        <div class="modal-overlay hidden" id="profile-modal">
          <div class="modal-card">
            <div class="modal-header">
              <h3>User Profile</h3>
              <button class="modal-close" id="profile-close">✕</button>
            </div>
            <div class="modal-body" id="profile-modal-body">
              <!-- Content injected via JS -->
            </div>
            <div style="margin-top:24px;">
              <button class="btn-primary" id="modal-edit-btn" style="width:100%">✏️ Edit Profile</button>
            </div>
          </div>
        </div>
    `;
  }

  async function showProfileModal() {
    const user = await Auth.getCurrentUser();
    const bd = document.getElementById('profile-modal-body');
    if (bd && user) {
      bd.innerHTML = `
        <div class="pstat" style="margin-bottom:12px; text-align:left;">
          <span style="font-size:0.7rem; color:var(--text-3); text-transform:uppercase; margin-bottom:2px;">Name</span>
          <strong style="font-size:1.1rem; color:var(--text-1);">${user.name}</strong>
        </div>
        <div style="display:flex; gap:12px; margin-bottom:12px;">
          <div class="pstat" style="flex:1; text-align:left;">
            <span style="font-size:0.7rem; color:var(--text-3); text-transform:uppercase; margin-bottom:2px;">Age</span>
            <strong style="font-size:1rem; color:var(--text-1);">${user.profile?.age || '—'}</strong>
          </div>
          <div class="pstat" style="flex:1; text-align:left;">
            <span style="font-size:0.7rem; color:var(--text-3); text-transform:uppercase; margin-bottom:2px;">Risk Score</span>
            <strong style="font-size:1rem; color:var(--text-1);">${user.profile?.riskScore || '5'}/10</strong>
          </div>
        </div>
        <div class="pstat" style="text-align:left;">
          <span style="font-size:0.7rem; color:var(--text-3); text-transform:uppercase; margin-bottom:2px;">Financial Goals</span>
          <strong style="font-size:0.9rem; color:var(--text-1); line-height:1.4;">${user.profile?.goals?.length ? user.profile.goals.join(' • ') : 'None set'}</strong>
        </div>
      `;
    }
    document.getElementById('profile-modal')?.classList.remove('hidden');
  }

  return { init, showChat, showPastChats, showOnboarding, showAuth };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
