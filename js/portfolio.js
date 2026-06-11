// ============================================================
// portfolio.js — .txt Parser + Income Stress Analyzer
// ============================================================

const Portfolio = (() => {

  // Helper: parse Indian/Western number strings like "3,00,000" or "300000"
  function parseNum(str) {
    if (!str) return 0;
    return parseFloat(String(str).replace(/,/g, '')) || 0;
  }

  // =========================================================
  // JSON Parser & Logic for FinMind Portfolio
  // =========================================================

  function parsePortfolioJSON(jsonData) {
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    
    // totalAssets
    const assets = data.assets || [];
    const totalAssets = assets.reduce((sum, a) => sum + (a.qty * (a.price || 0)), 0);
    
    // totalLiabilities
    const liabilities = data.liabilities || [];
    const totalLiabilities = liabilities.reduce((sum, l) => sum + (l.principal_remaining || 0), 0);

    // netWorth
    const netWorth = totalAssets - totalLiabilities;

    // stressScore and flags
    let stressScore = 0;
    const flags = [];

    // Rule 1: high_debt_ratio
    if (totalAssets > 0 && totalLiabilities > 0.5 * totalAssets) {
      stressScore += 4;
      flags.push('high_debt_ratio');
    }

    // Rule 2: recent_sell_activity
    const txns = data.recent_transactions || [];
    const sells = txns.filter(t => t.type === 'SELL');
    if (sells.length >= 2) {
      stressScore += 2;
      flags.push('recent_sell_activity');
    }

    // Rule 3: overdue_payment
    const hasOverdue = liabilities.some(l => l.overdue);
    if (hasOverdue) {
      stressScore += 3;
      flags.push('overdue_payment');
    }

    // Rule 4: majority_portfolio_in_loss
    // Just mock this flag if explicitly passed or randomly detect via mock heuristics
    if (data.profile && data.profile.inLoss) { 
       stressScore += 2;
       flags.push('majority_portfolio_in_loss');
    }

    stressScore = Math.min(stressScore, 10);

    // Provide the identical exported schema keys requested by the user
    return {
      netWorth,
      totalAssets,
      totalLiabilities,
      stressScore,
      flags,
      profile: data.profile || {},
      assets,
      liabilities,
      // Legacy backwards-compatibility for app.js readers
      holdings: assets,
      transactions: txns,
      incomeHistory: data.incomeHistory || [],
      raw: jsonData
    };
  }

  // ── JSON Upload Handlers to bypass onboarding.js restrictions ──
  
  function handleJSONUpload(file) {
    if (!file || !file.name.endsWith('.json')) {
      alert('Please upload a .json file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => processJSONData(e.target.result);
    reader.readAsText(file);
  }

  const SAMPLE_TEMPLATE = {
    "profile": {
      "name": "Arjun Mehta",
      "age": 32,
      "occupation": "Software Engineer",
      "riskTolerance": "Moderate",
      "goals": ["Buy a house", "Retire at 50"],
      "last_updated": "2025-03-23"
    },
    "assets": [
      { "asset": "HDFCBANK", "type": "Stock", "qty": 20, "price": 1580 },
      { "asset": "INFY", "type": "Stock", "qty": 15, "price": 1720 },
      { "asset": "GOLDBEES", "type": "ETF", "qty": 50, "price": 58 },
      { "asset": "NIFTYBEES", "type": "ETF", "qty": 100, "price": 220 },
      { "asset": "SBI FD 1-Year", "type": "Fixed Deposit", "qty": 1, "price": 150000, "rate": 7.1 }
    ],
    "liabilities": [
      { "type": "Personal Loan", "lender": "ICICI Bank", "principal_remaining": 50000 },
      { "type": "Credit Card", "lender": "HDFC", "principal_remaining": 15000 }
    ],
    "recent_transactions": [
      { "date": "2024-10-05", "type": "BUY", "asset": "HDFCBANK", "qty": 5, "price": 1560 },
      { "date": "2024-12-12", "type": "SELL", "asset": "INFY", "qty": 5, "price": 1750 },
      { "date": "2024-12-30", "type": "BUY", "asset": "NIFTYBEES", "qty": 50, "price": 215 },
      { "date": "2025-01-28", "type": "SELL", "asset": "HDFCBANK", "qty": 5, "price": 1540 },
      { "date": "2025-02-10", "type": "SELL", "asset": "NIFTYBEES", "qty": 30, "price": 212 },
      { "date": "2025-03-05", "type": "BUY", "asset": "NIFTYBEES", "qty": 20, "price": 210 }
    ],
    "incomeHistory": [
      { "month": "Oct 2024", "amount": 95000 },
      { "month": "Nov 2024", "amount": 95000 },
      { "month": "Dec 2024", "amount": 95000 },
      { "month": "Jan 2025", "amount": 60000 },
      { "month": "Feb 2025", "amount": 0 },
      { "month": "Mar 2025", "amount": 30000 }
    ]
  };

  function getSampleTemplate() {
    return JSON.stringify(SAMPLE_TEMPLATE);
  }

  function downloadTemplate() {
    const jsonStr = JSON.stringify(SAMPLE_TEMPLATE, null, 2);
    const blob = new window.Blob([jsonStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio_template.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // Legacy fallback computeNetWorth
  function computeNetWorth(parsedPortfolio) {
    return parsedPortfolio.netWorth || 0;
  }

  // Legacy fallback analyzeStress
  function analyzeStress(parsedPortfolio) {
    return {
      stressScore: parsedPortfolio.stressScore || 0,
      flags: parsedPortfolio.flags || [],
      incomeTrend: parsedPortfolio.incomeHistory || []
    };
  }

  function summarizeForAgent(parsedPortfolio, stressAnalysis) {
    const holdingLines = (parsedPortfolio.assets || [])
      .map(h => `${h.asset}: ${h.qty} units @ ₹${(h.price||0).toLocaleString()}`)
      .join('\\n');

    const txLines = (parsedPortfolio.transactions || [])
      .slice(-10) 
      .map(t => `${t.date}: ${t.type} ${t.asset} ${t.qty} @ ₹${(t.price||0).toLocaleString()}`)
      .join('\\n');

    const incomeLine = (stressAnalysis?.incomeTrend || [])
      .map(i => `${i.month}: ₹${(i.amount||0).toLocaleString()}`)
      .join(', ');

    return {
      holdingsSummary: holdingLines,
      transactionsSummary: txLines,
      incomeSummary: incomeLine,
      netWorth: parsedPortfolio.netWorth || 0,
      stressScore: stressAnalysis?.stressScore || 0,
      stressFlags: stressAnalysis?.flags || [],
      // Push extra payload to summary root in case it gets spread into portfolioContext by app.js:
      flags: parsedPortfolio.flags || [],
      assets: parsedPortfolio.assets || [],
      liabilities: parsedPortfolio.liabilities || [],
      profile: parsedPortfolio.profile || {},
    };
  }

  return { 
    parsePortfolioJSON, 
    getSampleTemplate,
    downloadTemplate,
    analyzeStress, 
    computeNetWorth, 
    summarizeForAgent 
  };
})();
