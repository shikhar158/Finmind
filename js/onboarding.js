// ============================================================
// onboarding.js — 5-Step Wizard + .txt Portfolio Parser
// ============================================================

const Onboarding = (() => {
  let currentStep = 1;
  const TOTAL_STEPS = 5;
  let wizardData = {
    age: '', income: '', occupation: '',
    goals: [],
    riskScore: 5,
    totalInvested: '',
    assetClasses: [],
    concerns: '',
    parsedPortfolio: null,
    stressAnalysis: null,
    country: 'Global',
    preferredAssets: []
  };

  async function startEdit() {
    const user = await Auth.getCurrentUser();
    if (user && user.profile) {
      wizardData = {
        age: user.profile.age || '',
        income: user.profile.income || '',
        occupation: user.profile.occupation || '',
        goals: user.profile.goals || [],
        riskScore: user.profile.riskScore || 5,
        totalInvested: user.profile.totalInvested || '',
        assetClasses: user.profile.assetClasses || [],
        concerns: user.profile.concerns || '',
        parsedPortfolio: user.portfolio || null,
        stressAnalysis: user.stressAnalysis || null,
        country: user.profile.country || 'Global',
        preferredAssets: user.profile.preferredAssets || []
      };
    }
    currentStep = 1;
    if (typeof App !== 'undefined') App.showOnboarding();
  }

  function init() {
    render();
    bindEvents();
  }

  async function render() {
    const container = document.getElementById('onboarding-container');
    container.innerHTML = await getStepHTML(currentStep);
    await updateProgress();
    bindStepEvents();
  }

  async function updateProgress() {
    const bar = document.getElementById('ob-progress-bar');
    const label = document.getElementById('ob-step-label');
    if (bar) bar.style.width = `${(currentStep / TOTAL_STEPS) * 100}%`;
    if (label) label.textContent = `Step ${currentStep} of ${TOTAL_STEPS}`;

    // Manage Back Button visibility and text
    const prevBtn = document.getElementById('ob-prev');
    if (prevBtn) {
      if (currentStep === 1) {
        const user = await Auth.getCurrentUser();
        if (user && user.onboardingDone) {
          prevBtn.style.visibility = 'visible';
          prevBtn.textContent = 'Cancel Edit';
        } else {
          prevBtn.style.visibility = 'hidden';
        }
      } else {
        prevBtn.style.visibility = 'visible';
        prevBtn.textContent = '← Back';
      }
    }
  }

  async function getStepHTML(step) {
    const steps = {
      1: `
        <div class="ob-step" id="step-1">
          <div class="ob-icon">👤</div>
          <h2>Tell us about yourself</h2>
          <p class="ob-sub">We'll use this to personalize your financial advice</p>
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" id="ob-name" placeholder="e.g. Arjun Mehta" value="${(await Auth.getCurrentUser())?.name || ''}">
          </div>
          <div class="form-group">
            <label>Country / Region</label>
            <select id="ob-country">
              <option value="IN" ${wizardData.country === 'IN' || (!wizardData.country && typeof wizardData.income !== 'undefined') ? 'selected' : ''}>India 🇮🇳</option>
              <option value="US" ${wizardData.country === 'US' ? 'selected' : ''}>United States 🇺🇸</option>
              <option value="GB" ${wizardData.country === 'GB' ? 'selected' : ''}>United Kingdom 🇬🇧</option>
              <option value="Global" ${wizardData.country === 'Global' ? 'selected' : ''}>Global / Other 🌍</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Age</label>
              <input type="number" id="ob-age" placeholder="32" min="18" max="100" value="${wizardData.age}">
            </div>
            <div class="form-group">
              <label>Occupation</label>
              <input type="text" id="ob-occupation" placeholder="Software Engineer" value="${wizardData.occupation}">
            </div>
          </div>
          <div class="form-group">
            <label>Monthly Income (₹)</label>
            <select id="ob-income">
              <option value="25000" ${wizardData.income === '25000' ? 'selected' : ''}>Under ₹25,000</option>
              <option value="50000" ${wizardData.income === '50000' ? 'selected' : ''}>₹25,000 – ₹50,000</option>
              <option value="75000" ${wizardData.income === '75000' ? 'selected' : ''}>₹50,000 – ₹75,000</option>
              <option value="100000" ${wizardData.income === '100000' || !wizardData.income ? 'selected' : ''}>₹75,000 – ₹1,00,000</option>
              <option value="150000" ${wizardData.income === '150000' ? 'selected' : ''}>₹1,00,000 – ₹1,50,000</option>
              <option value="250000" ${wizardData.income === '250000' ? 'selected' : ''}>₹1,50,000+</option>
            </select>
          </div>
        </div>`,

      2: `
        <div class="ob-step" id="step-2">
          <div class="ob-icon">🎯</div>
          <h2>What are your financial goals?</h2>
          <p class="ob-sub">Select all that apply to you</p>
          <div class="goals-grid">
            ${[
              ['🏖️','Retirement Planning'],
              ['📈','Wealth Building'],
              ['🏠','Buy a Home'],
              ['🎓','Child Education'],
              ['🚨','Emergency Fund'],
              ['💹','Short-term Trading'],
              ['💰','Passive Income'],
              ['🌍','Geographic Diversification'],
            ].map(([icon, label]) => `
              <div class="goal-chip ${wizardData.goals.includes(label) ? 'selected' : ''}" data-goal="${label}">
                <span class="goal-icon">${icon}</span>
                <span>${label}</span>
              </div>`).join('')}
          </div>
        </div>`,

      3: `
        <div class="ob-step" id="step-3">
          <div class="ob-icon">⚖️</div>
          <h2>What's your risk tolerance?</h2>
          <p class="ob-sub">Answer honestly — this affects your advice significantly</p>
          <div class="risk-quiz">
            ${[
              { q: 'If your portfolio dropped 20% in a month, you would:', options: ['Sell everything immediately', 'Sell some to reduce exposure', 'Hold and wait', 'Buy more at the dip'], scores: [1,3,6,9] },
              { q: 'Your primary investment horizon is:', options: ['Less than 1 year', '1–3 years', '3–7 years', 'More than 7 years'], scores: [1,3,6,10] },
              { q: 'What best describes your investment style?', options: ['Safety first, low returns', 'Balanced growth', 'Aggressive growth', 'Maximum returns, max risk'], scores: [1,4,7,10] },
            ].map((q, i) => `
              <div class="quiz-question">
                <p class="q-text">${q.q}</p>
                <div class="q-options">
                  ${q.options.map((opt, j) => `
                    <button class="q-opt" data-q="${i}" data-score="${q.scores[j]}">${opt}</button>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
          <div class="risk-display">
            <span>Risk Score: </span><span id="risk-score-val">—</span><span>/10</span>
          </div>
        </div>`,

      4: `
        <div class="ob-step" id="step-4">
          <div class="ob-icon">💼</div>
          <h2>Your current portfolio</h2>
          <p class="ob-sub">Give us a quick overview of your investments</p>
          <div class="form-group">
            <label>Asset classes you prefer / Want to invest in</label>
            <div class="asset-chips">
              ${['Stocks','Mutual Funds','Gold','Crypto','Real Estate','FDs/Bonds','Cash'].map(a => `
                <div class="asset-chip ${(wizardData.preferredAssets || wizardData.assetClasses || []).includes(a) ? 'selected' : ''}" data-asset="${a}">${a}</div>
              `).join('')}
            </div>
          </div>
          <div class="form-group">
            <label>Describe any major financial goals or targets (e.g. buying a car, higher education)</label>
            <textarea id="ob-concerns" rows="4" placeholder="e.g. I want to build a house down payment of ₹25,00,000 in 3 years...">${wizardData.concerns || ''}</textarea>
          </div>
        </div>`,

      5: `
        <div class="ob-step" id="step-5">
          <div class="ob-icon">📄</div>
          <h2>Upload your portfolio file</h2>
          <p class="ob-sub">A .json file with your profile, assets, liabilities, and transactions</p>
          
          ${wizardData.parsedPortfolio ? `<div class="pstat" style="margin-bottom:15px;text-align:center;color:var(--green)">✅ Portfolio Already Loaded.<br>You can re-upload to replace it.</div>` : ''}

          <div class="upload-zone" id="upload-zone-json">
            <div class="upload-icon">📂</div>
            <p>Drag & drop your <code>.json</code> file here, or click to browse</p>
            <input type="file" id="json-file-input" accept=".json" style="display:none">
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 15px;">
              <button class="btn-secondary" onclick="document.getElementById('json-file-input').click()">Browse JSON</button>
              <button class="btn-secondary" onclick="Portfolio.downloadTemplate()">⬇ Download Template</button>
            </div>
          </div>
          <div class="divider-or"><span>or</span></div>
          <button class="btn-sample" id="load-json-sample-btn">
            📋 Load Sample Portfolio (JSON format)
          </button>
          <div id="portfolio-preview" class="portfolio-preview hidden"></div>
        </div>`,
    };
    return steps[step] || '';
  }

  function bindEvents() {
    document.addEventListener('click', e => {
      if (e.target.id === 'ob-next') nextStep();
      if (e.target.id === 'ob-prev') prevStep();
    });
  }

  function bindStepEvents() {
    // Step 2 — goal chips
    document.querySelectorAll('.goal-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('selected');
      });
    });

    // Step 3 — risk quiz
    let quizScores = {};
    document.querySelectorAll('.q-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.q;
        document.querySelectorAll(`[data-q="${q}"]`).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        quizScores[q] = parseInt(btn.dataset.score);
        const total = Object.values(quizScores).reduce((a, b) => a + b, 0);
        const avg = Math.round(total / Object.keys(quizScores).length);
        const el = document.getElementById('risk-score-val');
        if (el) { el.textContent = avg; wizardData.riskScore = avg; }
      });
    });

    // Step 4 — asset chips
    document.querySelectorAll('.asset-chip').forEach(chip => {
      chip.addEventListener('click', () => chip.classList.toggle('selected'));
    });

    // Step 5 — file upload
    const fileInput = document.getElementById('json-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', e => handleFileUpload(e.target.files[0]));
    }

    const loadSample = document.getElementById('load-json-sample-btn');
    if (loadSample) {
      loadSample.addEventListener('click', () => {
        processJSONData(Portfolio.getSampleTemplate());
      });
    }

    const zone = document.getElementById('upload-zone-json');
    if (zone) {
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
      });
    }
  }

  function handleFileUpload(file) {
    if (!file || !file.name.endsWith('.json')) {
      alert('Please upload a .json file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => processJSONData(e.target.result);
    reader.readAsText(file);
  }

  function processJSONData(jsonString) {
    try {
      const parsed = Portfolio.parsePortfolioJSON(jsonString);
      
      wizardData.parsedPortfolio = parsed;
      wizardData.stressAnalysis = {
        stressScore: parsed.stressScore,
        flags: parsed.flags,
        incomeTrend: parsed.incomeHistory
      };

      const preview = document.getElementById('portfolio-preview');
      if (!preview) return;
      preview.classList.remove('hidden');
      preview.innerHTML = `
        <div class="preview-success">✅ JSON Portfolio loaded successfully</div>
        <div class="preview-stats">
          <div class="pstat"><span>Assets</span><strong>${parsed.assets.length}</strong></div>
          <div class="pstat"><span>Liabilities</span><strong>${parsed.liabilities.length}</strong></div>
          <div class="pstat"><span>Net Worth</span><strong>₹${parsed.netWorth.toLocaleString('en-IN')}</strong></div>
          <div class="pstat stress-${parsed.stressScore >= 7 ? 'high' : parsed.stressScore >= 4 ? 'med' : 'low'}">
            <span>Stress</span><strong>${parsed.stressScore}/10</strong>
          </div>
        </div>
        ${parsed.flags.length ? `<div class="stress-flags">${parsed.flags.map(f => f.replace(/_/g, ' ')).join('<br>')}</div>` : ''}
      `;
    } catch (err) {
      console.error(err);
      alert('Invalid JSON format. Please use the template.');
    }
  }

  function collectStep() {
    if (currentStep === 1) {
      wizardData.age = document.getElementById('ob-age')?.value || '';
      wizardData.occupation = document.getElementById('ob-occupation')?.value || '';
      wizardData.income = document.getElementById('ob-income')?.value || '';
      wizardData.country = document.getElementById('ob-country')?.value || 'Global';
    }
    if (currentStep === 2) {
      wizardData.goals = [...document.querySelectorAll('.goal-chip.selected')].map(c => c.dataset.goal);
    }
    if (currentStep === 4) {
      wizardData.preferredAssets = [...document.querySelectorAll('.asset-chip.selected')].map(c => c.dataset.asset);
      wizardData.concerns = document.getElementById('ob-concerns')?.value || '';
    }
  }

  function nextStep() {
    collectStep();
    if (currentStep < TOTAL_STEPS) {
      currentStep++;
      render();
    } else {
      completeOnboarding();
    }
  }

  async function prevStep() {
    if (currentStep > 1) { 
      currentStep--; 
      await render(); 
    } else if (currentStep === 1) {
      const user = await Auth.getCurrentUser();
      if (user && user.onboardingDone && typeof App !== 'undefined') {
        App.showChat();
      }
    }
  }

  async function completeOnboarding() {
    const user = await Auth.getCurrentUser();
    await Auth.updateUser({
      onboardingDone: true,
      profile: {
        age: wizardData.age,
        occupation: wizardData.occupation,
        income: wizardData.income,
        goals: wizardData.goals,
        riskScore: wizardData.riskScore,
        totalInvested: wizardData.totalInvested, // preserve if exists
        assetClasses: wizardData.preferredAssets || wizardData.assetClasses, 
        preferredAssets: wizardData.preferredAssets,
        concerns: wizardData.concerns,
        country: wizardData.country || 'Global'
      },
      portfolio: wizardData.parsedPortfolio,
      stressAnalysis: wizardData.stressAnalysis,
    });
    // Transition to chat
    if (typeof App !== 'undefined') App.showChat();
  }

  return { init, startEdit };
})();
