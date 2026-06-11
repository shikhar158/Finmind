// ============================================================
// toneAnalyzer.js — Voice Emotion and Stress Scoring via Meyda.js
// ============================================================

const VoiceAnalyzer = (() => {
  let audioContext = null;
  let analyzer = null;
  let stream = null;
  let buffers = { rms: [], zcr: [], centroid: [], flatness: [] };
  let startTime = 0;
  let wordCount = 0;

  async function start() {
    try {
      buffers = { rms: [], zcr: [], centroid: [], flatness: [] };
      wordCount = 0;
      startTime = Date.now();

      // Get microphone stream
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);

      // Create Meyda Analyzer
      if (typeof Meyda === 'undefined') {
        throw new Error('Meyda is not loaded. Please include meyda.js in index.html');
      }

      analyzer = Meyda.createMeydaAnalyzer({
        audioContext: audioContext,
        source: source,
        bufferSize: 1024, // good medium size for balancing lag vs extraction quality
        featureExtractors: ['rms', 'zcr', 'spectralCentroid', 'spectralFlatness'],
        callback: (features) => {
          if (features) {
            if (typeof features.rms === 'number') buffers.rms.push(features.rms);
            if (typeof features.zcr === 'number') buffers.zcr.push(features.zcr);
            if (typeof features.spectralCentroid === 'number') buffers.centroid.push(features.spectralCentroid);
            if (typeof features.spectralFlatness === 'number') buffers.flatness.push(features.spectralFlatness);
          }
        }
      });

      analyzer.start();
      console.log('Voice Tone Analysis started.');
    } catch (err) {
      console.error('ToneAnalyzer Start Error:', err);
      throw err;
    }
  }

  function countWord() {
    wordCount++;
  }

  function stop() {
    try {
      if (analyzer) analyzer.stop();
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (audioContext) audioContext.close();
    } catch (e) {
      console.error('Error stopping ToneAnalyzer streams:', e);
    }

    const durationSec = (Date.now() - startTime) / 1000;
    const speakingRate = durationSec > 0 ? (wordCount / durationSec) * 60 : 0;

    if (buffers.rms.length === 0) {
      return { toneScore: 0, speakingRate: 0, dominantSignal: "normal" };
    }

    // --- 1. Averages ---
    const avgRms = buffers.rms.reduce((a, b) => a + b, 0) / buffers.rms.length;
    const avgFlatness = buffers.flatness.reduce((a, b) => a + b, 0) / buffers.flatness.length;

    // --- 2. Standard Deviations (for Pitch Variance and Tremor) ---
    const calcStdDev = (arr) => {
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / arr.length);
    };
    const pitchVariance = calcStdDev(buffers.centroid);
    const tremor = calcStdDev(buffers.rms);

    // --- 3. Normalization into 0.0 - 1.0 ranges ---
    // normalized Speaking Rate: assume 130-140 normal, higher is stress. 
    const normRate = Math.min(Math.abs(speakingRate - 130) / 70, 1.0);
    const normPitchVar = Math.min(pitchVariance / 300, 1.0); 
    const normEnergy = Math.min(avgRms * 12, 1.0); // rms is usually < 0.1 for speech
    const normTremor = Math.min(tremor * 150, 1.0); 
    const normClarity = Math.max(0, 1.0 - avgFlatness); // higher flatness is noisier, lower is clearer

    // --- 4. Weighted Composite Score ---
    // specs: speakingRate 30%, pitchVariance 25%, energy 20%, tremor 15%, clarity 10%
    const toneScore = (
      normRate * 0.30 +
      normPitchVar * 0.25 +
      normEnergy * 0.20 +
      normTremor * 0.15 +
      normClarity * 0.10
    );

    // --- 5. Dominant Signal Trigger ---
    let dominantSignal = "normal";
    if (speakingRate > 150) {
      dominantSignal = "fast_speech";
    } else if (tremor > 0.012) {
      dominantSignal = "tremor";
    } else if (pitchVariance > 180) {
      dominantSignal = "high_pitch";
    } else if (avgFlatness > 0.35) {
      dominantSignal = "low_clarity";
    }

    console.log('Voice Analysis Result:', { speakingRate, avgRms, pitchVariance, tremor, toneScore, dominantSignal });

    return {
      toneScore: Math.min(Math.max(toneScore, 0.0), 1.0),
      speakingRate: Math.round(speakingRate),
      dominantSignal
    };
  }

  return { start, stop, countWord };
})();
