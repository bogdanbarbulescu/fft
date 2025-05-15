// --- DOM Elements ---
const themeToggle = document.getElementById('theme-toggle');
const themeToggleIcon = themeToggle.querySelector('svg');
const themeToggleText = themeToggle.querySelector('span');
const tabs = document.querySelectorAll('.tab'); 
const tabContents = document.querySelectorAll('.tab-content');
const appButtons = document.querySelectorAll('.application-button');
const appContents = document.querySelectorAll('.app-content');
const signalTypeSelect = document.getElementById('signal-type');
const frequencySlider = document.getElementById('frequency');
const frequencyValueSpan = document.getElementById('frequency-value');
const amplitudeSlider = document.getElementById('amplitude');
const amplitudeValueSpan = document.getElementById('amplitude-value');
const phaseSlider = document.getElementById('phase');
const phaseValueSpan = document.getElementById('phase-value');
const generateButton = document.getElementById('generate-signal');
const customSignalsDiv = document.getElementById('custom-signals');
const componentContainer = document.getElementById('component-container');
const addComponentButton = document.getElementById('add-component');
const removeComponentButton = document.getElementById('remove-component');
const micButton = document.getElementById('mic-button');
const filterTypeSelect = document.getElementById('filter-type');
const cutoffFrequencySlider = document.getElementById('cutoff-frequency');
const cutoffValueSpan = document.getElementById('cutoff-value');
const bandwidthControl = document.getElementById('bandwidth-control');
const bandwidthSlider = document.getElementById('bandwidth');
const bandwidthValueSpan = document.getElementById('bandwidth-value');
const phaseSpectrumChartCanvas = document.getElementById('phase-spectrum-chart');
const waterfallChartCanvas = document.getElementById('waterfall-chart');
const statRmsEl = document.getElementById('stat-rms');
const statPeakEl = document.getElementById('stat-peak');
const statCrestEl = document.getElementById('stat-crest');
const statThdEl = document.getElementById('stat-thd');
const importFileEl = document.getElementById('import-file');
const exportTimeCsvBtn = document.getElementById('export-time-csv');
const exportFreqCsvBtn = document.getElementById('export-freq-csv');
const spectrogramColormapSelect = document.getElementById('spectrogram-colormap');
const spectrogramLogScaleCheckbox = document.getElementById('spectrogram-logscale');
const specMinMagInput = document.getElementById('spec-min-mag');
const specMaxMagInput = document.getElementById('spec-max-mag');


// --- State Variables ---
let componentCount = 0;
let isRecording = false;
let audioContext;
let analyser;
let microphone;
let timeData; 
let freqData; 
let phaseData; 
let complexFftResult; 
let animationFrameId;
let sampleRate = 44100; 
let bufferSize = 1024; // Default visual buffer size, for mic it's analyser.frequencyBinCount
let spectrogramData = [];
const spectrogramHeight = 100; 
let globalSignalDuration = bufferSize / sampleRate;


// --- Charts ---
let chartInstances = {}; 
let spectrogramChartCtx; 

// Chart.js plugins should be registered automatically if loaded globally via CDN before Chart.js itself,
// or Chart.js might pick them up. If not, explicit registration might be needed,
// but often CDNs handle this correctly. For v3+:
// Chart.register(ChartZoom, ChartAnnotation); // If imported as modules.

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  timeData = new Float32Array(bufferSize);
  freqData = new Float32Array(bufferSize / 2); // Default for generated signals before FFT
  phaseData = new Float32Array(bufferSize / 2); // Default for generated signals before FFT
  initCharts();
  setupEventListeners();
  updateSliderMaxFreq();
  generateSignal(); 
  checkTheme();
});

// --- Theme Handling ---
function checkTheme() {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
        document.body.classList.add('dark-theme');
        updateThemeButton(true);
    } else {
        document.body.classList.remove('dark-theme');
        updateThemeButton(false);
    }
    updateChartStyles();
}

function updateThemeButton(isDark) {
     if (isDark) {
        themeToggleIcon.innerHTML = '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>';
        themeToggleText.textContent = 'Light Mode';
    } else {
        themeToggleIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
        themeToggleText.textContent = 'Dark Mode';
    }
}

themeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-theme');
  updateThemeButton(isDark);
  updateChartStyles();
});

// --- Event Listeners Setup ---
function setupEventListeners() {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
      if (tabId === 'waterfall') drawWaterfall();
    });
  });

  appButtons.forEach(button => {
    button.addEventListener('click', () => {
      appButtons.forEach(b => b.classList.remove('active'));
      appContents.forEach(c => c.classList.remove('active'));
      button.classList.add('active');
      document.getElementById(`app-${button.getAttribute('data-app')}`).classList.add('active');
      if (button.getAttribute('data-app') === 'filter-demo') updateFilterDemo();
      if (button.getAttribute('data-app') === 'harmonic-analyzer') updateHarmonicAnalyzer();
    });
  });

  frequencySlider.addEventListener('input', e => {
      frequencyValueSpan.textContent = `${e.target.value} Hz`;
      if (!isRecording && signalTypeSelect.value !== 'custom') generateSignal();
  });
  amplitudeSlider.addEventListener('input', e => {
      amplitudeValueSpan.textContent = `${parseFloat(e.target.value).toFixed(1)}`;
       if (!isRecording && signalTypeSelect.value !== 'custom') generateSignal();
  });
  phaseSlider.addEventListener('input', e => {
      phaseValueSpan.textContent = `${e.target.value}°`;
       if (!isRecording && signalTypeSelect.value !== 'custom') generateSignal();
  });
  signalTypeSelect.addEventListener('change', e => {
      customSignalsDiv.style.display = e.target.value === 'custom' ? 'block' : 'none';
      const isDisabled = e.target.value === 'custom' || isRecording;
      frequencySlider.disabled = isDisabled;
      amplitudeSlider.disabled = isDisabled;
      phaseSlider.disabled = isDisabled;
      if (!isRecording) generateSignal();
  });

  addComponentButton.addEventListener('click', addComponent);
  removeComponentButton.addEventListener('click', removeComponent);
  generateButton.addEventListener('click', () => {
      if (isRecording) { // Stop mic if generating a signal
        toggleMicrophoneInput().then(() => generateSignal());
      } else {
        generateSignal();
      }
  });
  micButton.addEventListener('click', toggleMicrophoneInput);

  filterTypeSelect.addEventListener('change', () => {
      bandwidthControl.style.display = ['bandpass', 'notch'].includes(filterTypeSelect.value) ? 'block' : 'none';
      updateFilterDemo();
  });
  cutoffFrequencySlider.addEventListener('input', e => {
      cutoffValueSpan.textContent = `${e.target.value} Hz`;
      updateFilterDemo();
  });
   bandwidthSlider.addEventListener('input', e => {
      bandwidthValueSpan.textContent = `${e.target.value} Hz`;
      updateFilterDemo();
  });

  exportTimeCsvBtn.addEventListener('click', exportTimeDataAsCSV);
  exportFreqCsvBtn.addEventListener('click', exportFreqDataAsCSV);
  importFileEl.addEventListener('change', handleFileUpload);
  spectrogramColormapSelect.addEventListener('change', drawSpectrogram);
  spectrogramLogScaleCheckbox.addEventListener('change', drawSpectrogram);
  specMinMagInput.addEventListener('change', drawSpectrogram);
  specMaxMagInput.addEventListener('change', drawSpectrogram);
}

// --- Chart Initialization ---
function initCharts() {
  const contexts = {
    time: document.getElementById('time-domain-chart').getContext('2d'),
    freq: document.getElementById('frequency-domain-chart').getContext('2d'),
    phase: phaseSpectrumChartCanvas.getContext('2d'),
    spectrogram: document.getElementById('spectrogram-chart').getContext('2d'),
    component: document.getElementById('component-breakdown-chart').getContext('2d'),
    audioAnalyzer: document.getElementById('audio-analyzer-chart').getContext('2d'),
    filterDemo: document.getElementById('filter-demo-chart').getContext('2d'),
    harmonicAnalyzer: document.getElementById('harmonic-analyzer-chart').getContext('2d'),
    waterfall: waterfallChartCanvas.getContext('2d'),
  };
  spectrogramChartCtx = contexts.spectrogram;

  const baseChartOptions = () => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    scales: {
      x: {
        grid: { color: getComputedStyle(document.body).getPropertyValue('--chart-grid') },
        ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-color'), maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
      },
      y: {
        grid: { color: getComputedStyle(document.body).getPropertyValue('--chart-grid') },
        ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-color') },
        beginAtZero: true
      }
    },
    plugins: {
      legend: { labels: { color: getComputedStyle(document.body).getPropertyValue('--text-color') } },
      zoom: { // ZOOM PLUGIN CONFIG
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy', speed: 0.1 },
        pan: { enabled: true, mode: 'xy', speed: 10, threshold: 5 }
      },
      annotation: { // Default empty annotations
          annotations: {}
      }
    }
  });

  const timeLabels = () => Array.from({ length: timeData.length }, (_, i) => (i * 1000 / sampleRate).toFixed(1));
  const freqLabels = () => Array.from({ length: freqData.length }, (_, i) => (i * sampleRate / (isRecording && analyser ? analyser.fftSize : bufferSize*2)).toFixed(1));


  chartInstances.time = new Chart(contexts.time, {
    type: 'line',
    data: { labels: timeLabels(), datasets: [{ label: 'Time Domain', data: timeData, borderColor: 'var(--primary-color)', borderWidth: 1.5, pointRadius: 0, fill: false }] },
    options: { ...baseChartOptions(), scales: { ...baseChartOptions().scales,
        x: { ...baseChartOptions().scales.x, title: { display: true, text: 'Time (ms)', color: 'var(--text-color)' }},
        y: { ...baseChartOptions().scales.y, min: -2, max: 2, title: { display: true, text: 'Amplitude', color: 'var(--text-color)' }}
    }}
  });

  chartInstances.freq = new Chart(contexts.freq, {
    type: 'bar',
    data: { labels: freqLabels(), datasets: [{ label: 'Frequency Domain (Magnitude)', data: freqData, backgroundColor: 'var(--primary-color)', borderWidth: 0 }] },
     options: { ...baseChartOptions(), scales: { ...baseChartOptions().scales,
        x: { ...baseChartOptions().scales.x, title: { display: true, text: 'Frequency (Hz)', color: 'var(--text-color)' }},
        y: { ...baseChartOptions().scales.y, title: { display: true, text: 'Magnitude', color: 'var(--text-color)' }}
    }}
  });

  chartInstances.phase = new Chart(contexts.phase, {
    type: 'line',
    data: { labels: freqLabels(), datasets: [{ label: 'Phase Spectrum (Unwrapped)', data: phaseData, borderColor: 'var(--accent-color)', borderWidth: 1.5, pointRadius: 0, fill: false }] },
    options: { ...baseChartOptions(), scales: { ...baseChartOptions().scales,
        x: { ...baseChartOptions().scales.x, title: { display: true, text: 'Frequency (Hz)', color: 'var(--text-color)' }},
        y: { ...baseChartOptions().scales.y, title: { display: true, text: 'Phase (Radians)', color: 'var(--text-color)' }}
    }}
  });

  chartInstances.component = new Chart(contexts.component, {
    type: 'line', data: { labels: timeLabels(), datasets: [] },
    options: { ...baseChartOptions(), plugins: { ...baseChartOptions().plugins, legend: { display: true } }, scales: {...baseChartOptions().scales,
        x: { ...baseChartOptions().scales.x, title: { display: true, text: 'Time (ms)', color: 'var(--text-color)' }},
        y: { ...baseChartOptions().scales.y, min: -2, max: 2, title: { display: true, text: 'Amplitude', color: 'var(--text-color)' }}
    }}
  });

   chartInstances.audioAnalyzer = new Chart(contexts.audioAnalyzer, {
    type: 'bar', data: { labels: freqLabels(), datasets: [{ label: 'Audio Spectrum', data: new Float32Array(bufferSize/2), backgroundColor: 'var(--accent-color)', borderWidth: 0 }] },
    options: { ...baseChartOptions(), plugins: { ...baseChartOptions().plugins, legend: { display: false } }, scales: {...baseChartOptions().scales,
        x: { ...baseChartOptions().scales.x, title: { display: true, text: 'Frequency (Hz)', color: 'var(--text-color)' }},
        y: { ...baseChartOptions().scales.y, title: { display: true, text: 'Magnitude', color: 'var(--text-color)' }}
    }}
  });

  chartInstances.filterDemo = new Chart(contexts.filterDemo, {
    type: 'line', data: { labels: freqLabels(), datasets: [
        { label: 'Original Spectrum', data: new Float32Array(bufferSize/2), borderColor: 'var(--secondary-color)', borderWidth: 1.5, pointRadius: 0, fill: false },
        { label: 'Filtered Spectrum', data: new Float32Array(bufferSize/2), borderColor: 'var(--accent-color)', borderWidth: 1.5, pointRadius: 0, fill: false }
      ]},
     options: { ...baseChartOptions(), scales: {...baseChartOptions().scales,
        x: { ...baseChartOptions().scales.x, title: { display: true, text: 'Frequency (Hz)', color: 'var(--text-color)' }},
        y: { ...baseChartOptions().scales.y, title: { display: true, text: 'Magnitude', color: 'var(--text-color)' }}
    }}
  });

  chartInstances.harmonicAnalyzer = new Chart(contexts.harmonicAnalyzer, {
    type: 'bar', data: { labels: ['Fund.', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'], datasets: [{ label: 'Harmonic Strength', data: new Array(8).fill(0), backgroundColor: 'var(--primary-color)', borderWidth: 1 }] },
    options: { ...baseChartOptions(), plugins: { ...baseChartOptions().plugins, legend: { display: false } }, scales: {...baseChartOptions().scales,
        x: { ...baseChartOptions().scales.x, title: { display: true, text: 'Harmonic', color: 'var(--text-color)' }},
        y: { ...baseChartOptions().scales.y, title: { display: true, text: 'Relative Magnitude', color: 'var(--text-color)' }}
    }}
  });

  drawWaterfall(); // Initial placeholder draw for waterfall canvas
}

// --- Chart Style Update ---
function updateChartStyles() {
  const gridColor = getComputedStyle(document.body).getPropertyValue('--chart-grid');
  const textColor = getComputedStyle(document.body).getPropertyValue('--text-color');
  const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary-color');
  const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-color');
  const secondaryColor = getComputedStyle(document.body).getPropertyValue('--secondary-color');

  Object.values(chartInstances).forEach(chart => {
    if (!chart || !chart.options) return; // Ensure chart and options exist
    chart.options.scales.x.grid.color = gridColor;
    chart.options.scales.y.grid.color = gridColor;
    chart.options.scales.x.ticks.color = textColor;
    chart.options.scales.y.ticks.color = textColor;
    if(chart.options.scales.x.title) chart.options.scales.x.title.color = textColor;
    if(chart.options.scales.y.title) chart.options.scales.y.title.color = textColor;
    if (chart.options.plugins && chart.options.plugins.legend) {
      chart.options.plugins.legend.labels.color = textColor;
    }

    // Specific dataset color updates
    if (chart === chartInstances.time) chart.data.datasets[0].borderColor = primaryColor;
    if (chart === chartInstances.freq) chart.data.datasets[0].backgroundColor = primaryColor;
    if (chart === chartInstances.phase) chart.data.datasets[0].borderColor = accentColor;
    if (chart === chartInstances.audioAnalyzer) chart.data.datasets[0].backgroundColor = accentColor;
    if (chart === chartInstances.filterDemo) {
        chart.data.datasets[0].borderColor = secondaryColor;
        chart.data.datasets[1].borderColor = accentColor;
    }
    if (chart === chartInstances.harmonicAnalyzer) chart.data.datasets[0].backgroundColor = primaryColor;
    // Component chart datasets are colored dynamically, no general update here needed for that.

    chart.update('none');
  });
  if (spectrogramChartCtx) drawSpectrogram();
  if (document.querySelector('.tab[data-tab="waterfall"].active')) drawWaterfall();
}

// --- Signal Generation ---
function generateSignal() {
  const type = signalTypeSelect.value;
  const freq = parseFloat(frequencySlider.value);
  const amp = parseFloat(amplitudeSlider.value);
  const ph = parseFloat(phaseSlider.value) * Math.PI / 180;

  // Reset timeData to the visual buffer size for generated signals
  timeData = new Float32Array(bufferSize); 

  if (type === 'custom') {
    const components = componentContainer.querySelectorAll('.component');
    components.forEach(component => {
      const compType = component.querySelector('.component-type').value;
      const compFreq = parseFloat(component.querySelector('.component-freq').value);
      const compAmp = parseFloat(component.querySelector('.component-amp').value);
      const compPhase = parseFloat(component.querySelector('.component-phase').value) * Math.PI / 180;
      addSignalComponent(timeData, compType, compFreq, compAmp, compPhase);
    });
    let maxAbs = 0;
    for(let i = 0; i < timeData.length; i++) maxAbs = Math.max(maxAbs, Math.abs(timeData[i]));
    if (maxAbs > amp && maxAbs > 0) { // Normalize if sum exceeds main amplitude
         const scaleFactor = amp / maxAbs;
         for(let i = 0; i < timeData.length; i++) timeData[i] *= scaleFactor;
    }
  } else {
    addSignalComponent(timeData, type, freq, amp, ph);
  }

  if (!isRecording) {
      globalSignalDuration = timeData.length / sampleRate; // Duration for the visual buffer
  }
  performFFTAndUpdate();
}

function addSignalComponent(targetArray, type, freq, amp, ph) {
   for (let i = 0; i < targetArray.length; i++) { 
    const t = i / sampleRate; // Time in seconds for this sample point
    let value = 0;
    const omega_t_phi = 2 * Math.PI * freq * t + ph;
    switch (type) {
      case 'sine': value = amp * Math.sin(omega_t_phi); break;
      case 'square': value = amp * Math.sign(Math.sin(omega_t_phi)); break;
      case 'triangle':
        const normalized_t_tri = (freq * t + ph / (2 * Math.PI)) % 1.0;
        value = amp * (2 * Math.abs(2 * (normalized_t_tri - Math.floor(normalized_t_tri + 0.5))) - 1);
        break;
      case 'sawtooth':
        const phaseShiftNormalized_saw = ph / (2 * Math.PI);
        value = amp * (2 * ((t * freq + phaseShiftNormalized_saw) % 1.0) - 1);
        break;
    }
    targetArray[i] += value; // Add to existing signal (for custom sum)
  }
}

 // --- FFT and Updates ---
function performFFTAndUpdate() {
    // timeData is now consistently the array to be FFT'd,
    // its length determines the FFT size.
    complexFftResult = math.fft(Array.from(timeData)); 

    const numFreqBins = timeData.length / 2; // FFT output (single-sided) has N/2 bins
    freqData = new Float32Array(numFreqBins);
    phaseData = new Float32Array(numFreqBins);

    const fftNormalizationFactor = timeData.length;


    for (let k = 0; k < numFreqBins; k++) {
        const re = complexFftResult[k].re;
        const im = complexFftResult[k].im;
        
        freqData[k] = Math.sqrt(re * re + im * im) / fftNormalizationFactor; 
        if (k > 0 && k < numFreqBins -1 ) { // Double for single-sided spectrum (not DC or Nyquist if N is even)
            freqData[k] *= 2;
        }
        phaseData[k] = Math.atan2(im, re);
    }
    phaseData = unwrapPhase(phaseData); // Unwrap the calculated phase data

    updateSpectrogramData(freqData); // Spectrogram uses the magnitude data
    updateVisualizations(); // Update all charts
    updateSignalStatistics(); // Calculate and display signal stats
    updatePeakMarkers(); // Add markers to frequency chart
}

function unwrapPhase(phases_in) {
    const unwrapped = new Float32Array(phases_in.length);
    if (phases_in.length === 0) return unwrapped;
    unwrapped[0] = phases_in[0];
    for (let i = 1; i < phases_in.length; i++) {
        let diff = phases_in[i] - phases_in[i-1];
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        unwrapped[i] = unwrapped[i-1] + diff;
    }
    return unwrapped;
}

 // --- Update Visualizations ---
 function updateVisualizations() {
    // Labels need to be updated based on current timeData length and freqData length
    const newTimeLabels = Array.from({ length: timeData.length }, (_, i) => (i * 1000 / sampleRate).toFixed(1));
    // Freq labels depend on the length of freqData (which is N/2 of the FFT input)
    const fftInputSize = timeData.length;
    const newFreqLabels = Array.from({ length: freqData.length }, (_, i) => (i * sampleRate / fftInputSize).toFixed(1));


    chartInstances.time.data.labels = newTimeLabels;
    chartInstances.time.data.datasets[0].data = timeData;
    chartInstances.time.update('none');

    chartInstances.freq.data.labels = newFreqLabels;
    chartInstances.freq.data.datasets[0].data = freqData;
    // Peak markers are updated in performFFTAndUpdate after freqData is set

    chartInstances.phase.data.labels = newFreqLabels;
    chartInstances.phase.data.datasets[0].data = phaseData;
    chartInstances.phase.update('none');

    drawSpectrogram(); // Handles its own drawing
    if (document.querySelector('.tab[data-tab="waterfall"].active')) drawWaterfall();

    updateAudioAnalyzer(newFreqLabels); 
    updateFilterDemo(newFreqLabels);
    updateHarmonicAnalyzer(); // Uses current freqData
    updateComponentBreakdown(newTimeLabels); // Uses current timeData and freqData
}

 // --- Custom Component Management ---
function addComponent() {
    componentCount++;
    const componentDiv = document.createElement('div');
    componentDiv.classList.add('component');
    componentDiv.id = `component-${componentCount}`;
    // Default frequency slightly offset for new components
    const defaultFreq = (componentCount * 5) + 5;
    componentDiv.innerHTML = `
        <div class="control-row">
            <div class="control-item"> <label for="comp-type-${componentCount}">Type</label> <select class="component-type" id="comp-type-${componentCount}"><option value="sine">Sine</option><option value="square">Square</option><option value="triangle">Triangle</option><option value="sawtooth">Sawtooth</option></select> </div>
            <div class="control-item"> <label for="comp-freq-${componentCount}">Freq (Hz)</label> <input type="number" class="component-freq" id="comp-freq-${componentCount}" value="${defaultFreq}" min="1" step="1"> </div>
        </div>
        <div class="control-row">
             <div class="control-item"> <label for="comp-amp-${componentCount}">Amp</label> <input type="number" class="component-amp" id="comp-amp-${componentCount}" value="0.5" min="0.1" step="0.1" max="2"> </div>
             <div class="control-item"> <label for="comp-phase-${componentCount}">Phase (°)</label> <input type="number" class="component-phase" id="comp-phase-${componentCount}" value="0" min="0" max="360" step="1"> </div>
        </div>`;
    componentContainer.appendChild(componentDiv);
    removeComponentButton.disabled = false;
    componentDiv.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', () => { if (!isRecording) generateSignal(); });
    });
     if (!isRecording) generateSignal(); // Regenerate after adding
}

function removeComponent() {
    if (componentCount > 0) {
        const lastComponent = document.getElementById(`component-${componentCount}`);
        if (lastComponent) lastComponent.remove();
        componentCount--;
        removeComponentButton.disabled = componentCount === 0;
         if (!isRecording) generateSignal(); // Regenerate after removing
    }
}

// --- Microphone Input ---
async function toggleMicrophoneInput() {
    if (isRecording) {
        if (microphone && microphone.mediaStream) microphone.mediaStream.getTracks().forEach(track => track.stop());
        if (audioContext && audioContext.state !== 'closed') await audioContext.close().catch(e=>console.warn("Error closing audio context:", e));
        audioContext = null; 
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        isRecording = false;
        micButton.classList.remove('recording');
        micButton.textContent = 'Use Mic Input';
        generateButton.disabled = false;
         const isCustom = signalTypeSelect.value === 'custom';
         frequencySlider.disabled = isCustom;
         amplitudeSlider.disabled = isCustom;
         phaseSlider.disabled = isCustom;
         // Re-enable custom component controls if signal type is custom
         if (isCustom) {
            customSignalsDiv.querySelectorAll('input, select, button').forEach(el => el.disabled = false);
            removeComponentButton.disabled = (componentCount === 0);
         } else { // Disable custom if not selected
            customSignalsDiv.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
         }
        
        // Reset bufferSize to default for generated signals
        bufferSize = 1024; 
        timeData = new Float32Array(bufferSize);
        freqData = new Float32Array(bufferSize / 2);
        phaseData = new Float32Array(bufferSize / 2);
        generateSignal(); // Generate a default signal after stopping

    } else { // Start recording
        try {
            if (!audioContext || audioContext.state === 'closed') {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            sampleRate = audioContext.sampleRate; // Use actual mic sample rate
            
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048; // A common FFT size for audio analysis
            // For mic input, timeData will be analyser.fftSize samples long.
            // freqData and phaseData will be analyser.frequencyBinCount (fftSize/2) long.
            
            timeData = new Float32Array(analyser.fftSize); 
            freqData = new Float32Array(analyser.frequencyBinCount);
            phaseData = new Float32Array(analyser.frequencyBinCount);
            // Note: `bufferSize` state variable isn't strictly used for mic data arrays,
            // but it's used for spectrogram slice length. Let's align it.
            bufferSize = analyser.frequencyBinCount; 
            
            updateSliderMaxFreq(); 

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            microphone = audioContext.createMediaStreamSource(stream);
            microphone.mediaStream = stream; // Store to stop tracks later
            microphone.connect(analyser);
            // Do not connect analyser to destination to avoid echo

            isRecording = true;
            micButton.classList.add('recording');
            micButton.textContent = 'Stop Mic Input';
            generateButton.disabled = true;
            // Disable all signal generator controls
            frequencySlider.disabled = true; amplitudeSlider.disabled = true; phaseSlider.disabled = true;
            signalTypeSelect.disabled = true; // Also disable signal type select
            customSignalsDiv.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
            

            processAudio(); // Start the processing loop
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Could not access microphone. Please check permissions or ensure another app is not using it.');
            if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(e=>console.warn("Error closing audio context after mic fail:", e));;
            audioContext = null;
            isRecording = false; // Reset recording state
        }
    }
}

function processAudio() {
    if (!isRecording || !analyser) return;

    // Get Time Domain Data from AnalyserNode
    analyser.getFloatTimeDomainData(timeData); // timeData length is analyser.fftSize

    // For magnitude: use AnalyserNode's frequency data (dB scale, then convert)
    const tempFreqDbData = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(tempFreqDbData); 
    
    const minDb = analyser.minDecibels;
    const maxDb = analyser.maxDecibels;
    const dbRange = maxDb - minDb;

    for (let i = 0; i < analyser.frequencyBinCount; i++) {
         if(dbRange > 0) freqData[i] = Math.max(0, (tempFreqDbData[i] - minDb) / dbRange); // Normalized linear 0-1
         else freqData[i] = 0;
    }

    // For phase: perform FFT on the timeData obtained from the mic
    // This is because AnalyserNode does not directly provide phase.
    const micComplexResult = math.fft(Array.from(timeData)); // FFT on full timeData (analyser.fftSize)
    
    for (let k = 0; k < analyser.frequencyBinCount; k++) { // Iterate up to frequencyBinCount
        const re = micComplexResult[k].re;
        const im = micComplexResult[k].im;
        phaseData[k] = Math.atan2(im, re);
    }
    phaseData = unwrapPhase(phaseData);
    
    globalSignalDuration = timeData.length / sampleRate; // Duration of the current analysis window

    updateSpectrogramData(freqData); // Spectrogram uses the linear magnitudes
    updateVisualizations(); 
    updateSignalStatistics();
    updatePeakMarkers();

    animationFrameId = requestAnimationFrame(processAudio);
}


 function updateSliderMaxFreq() {
    // Max frequency for the signal generator slider
    const maxFreqSlider = Math.floor(sampleRate / 10); 
    frequencySlider.max = Math.max(100, maxFreqSlider); 
    frequencySlider.value = Math.min(parseFloat(frequencySlider.value), parseFloat(frequencySlider.max));
    frequencyValueSpan.textContent = `${frequencySlider.value} Hz`;

    // Max frequency for the filter cutoff slider
    const maxCutoff = Math.floor(sampleRate / 2 - 1);
    cutoffFrequencySlider.max = maxCutoff > 0 ? maxCutoff : 100; // Ensure max is at least 100Hz
    cutoffFrequencySlider.value = Math.min(parseFloat(cutoffFrequencySlider.value), parseFloat(cutoffFrequencySlider.max));
    cutoffValueSpan.textContent = `${cutoffFrequencySlider.value} Hz`;

    // Max frequency for the filter bandwidth slider
    const maxBandwidth = Math.floor(sampleRate / 4);
    bandwidthSlider.max = maxBandwidth > 0 ? maxBandwidth : 50; // Ensure max is at least 50Hz
    bandwidthSlider.value = Math.min(parseFloat(bandwidthSlider.value), parseFloat(bandwidthSlider.max));
    bandwidthValueSpan.textContent = `${bandwidthSlider.value} Hz`;
}

// --- Spectrogram ---
function updateSpectrogramData(newFreqSlice) {
    if (spectrogramData.length >= spectrogramHeight) spectrogramData.shift(); // Remove oldest
    
    // The newFreqSlice length is analyser.frequencyBinCount (current `bufferSize` during mic)
    // or `timeData.length / 2` (current `freqData.length` for generated signals).
    // Ensure the slice added to spectrogramData matches this current frequency data length.
    const currentFreqDataLength = newFreqSlice.length;
    const sliceToAdd = new Float32Array(currentFreqDataLength); 
    for(let i=0; i<currentFreqDataLength; i++) sliceToAdd[i] = newFreqSlice[i];
    spectrogramData.push(sliceToAdd);
}

const colormaps = { // More distinct Viridis-like and Heatmaps
    viridis: (v) => { // Approximation of Viridis
        const c = [ // R, G, B values for points along the colormap
            [68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142], [38, 130, 142],
            [31, 158, 137], [53, 183, 121], [108, 206, 89], [180, 222, 44], [253, 231, 37]
        ];
        v = Math.max(0, Math.min(1, v)); // Clamp v
        const i0 = Math.floor(v * (c.length - 1));
        const i1 = Math.min(c.length - 1, i0 + 1);
        const t = (v * (c.length - 1)) - i0; // Interpolation factor
        const r = Math.floor(c[i0][0] * (1 - t) + c[i1][0] * t);
        const g = Math.floor(c[i0][1] * (1 - t) + c[i1][1] * t);
        const b = Math.floor(c[i0][2] * (1 - t) + c[i1][2] * t);
        return `rgb(${r},${g},${b})`;
    },
    grayscale: (v) => { const i = Math.floor(v * 255); return `rgb(${i},${i},${i})`; },
    heatmap1: (v) => { // Blue -> Cyan -> Green -> Yellow -> Red
        const r = v > 0.5 ? (v > 0.75 ? 255 : Math.floor(255 * (v - 0.5) * 4)) : 0;
        const g = v < 0.25 ? Math.floor(255 * v * 4) : (v > 0.75 ? Math.floor(255 * (1 - (v - 0.75) * 4)) : 255);
        const b_h1 = v < 0.5 ? (v < 0.25 ? Math.floor(255 * (1 - v * 4)) : 0) : 0;
        return `rgb(${r},${g},${b_h1})`;
    },
    heatmap2: (v) => { // Jet-like: Blue -> Green -> Red
        let r=0, g=0, b_h2=0;
        if (v < 0.33) { b_h2 = Math.floor(255 * (0.5 + v * 1.5)); g = 0; r = 0; }
        else if (v < 0.66) { b_h2 = Math.floor(255 * (1 - (v - 0.33) * 3)); g = Math.floor(255 * (v - 0.33) * 3); r = 0; }
        else { b_h2 = 0; g = Math.floor(255 * (1 - (v - 0.66) * 3)); r = Math.floor(255 * (v - 0.66) * 3); }
        return `rgb(${r},${g},${b_h2})`;
    }
};

function drawSpectrogram() {
    if (!spectrogramChartCtx) return;
    const canvas = spectrogramChartCtx.canvas;
    const ctx = spectrogramChartCtx;
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--card-bg');
    ctx.fillRect(0, 0, width, height);

    const numSlices = spectrogramData.length;
    if (numSlices === 0 || !spectrogramData[0]) return; // Check if first slice exists

    const selectedColormapFunc = colormaps[spectrogramColormapSelect.value] || colormaps.viridis;
    const useLogScale = spectrogramLogScaleCheckbox.checked;
    const minMag = parseFloat(specMinMagInput.value);
    const maxMag = parseFloat(specMaxMagInput.value);
    const magRange = Math.max(1e-6, maxMag - minMag);

    const sliceWidth = width / numSlices;
    const nyquist = sampleRate / 2;
    const minDisplayFreqLog = 20; 
    const minLogFreqValue = Math.log(Math.max(1, minDisplayFreqLog));
    const maxLogFreqValue = Math.log(Math.max(minDisplayFreqLog +1, nyquist)); 
    const logFreqDisplayRange = maxLogFreqValue - minLogFreqValue;

    // Determine the length of frequency data from a typical slice
    const freqDataLength = spectrogramData[0].length; 
    // Determine the FFT size that produced this freqDataLength
    // (freqDataLength is N/2, so FFT size is freqDataLength * 2)
    const effectiveFFTSize = freqDataLength * 2;


    for (let t = 0; t < numSlices; t++) {
        const currentSliceFreqData = spectrogramData[t];
        if (!currentSliceFreqData) continue;

        for (let f_bin = 0; f_bin < currentSliceFreqData.length; f_bin++) {
            let magnitude = currentSliceFreqData[f_bin];
            magnitude = (magnitude - minMag) / magRange;
            magnitude = Math.max(0, Math.min(1, magnitude)); // Clamp to 0-1

            const color = selectedColormapFunc(magnitude);
            ctx.fillStyle = color;
            
            const currentFreqHz = f_bin * (sampleRate / effectiveFFTSize); 
            let yPos, binH;

            if (useLogScale) {
                if (currentFreqHz < minDisplayFreqLog || logFreqDisplayRange <= 0) continue;
                
                const logCurrentFreq = Math.log(currentFreqHz);
                const relativeLogPos = (logCurrentFreq - minLogFreqValue) / logFreqDisplayRange;
                
                const nextFreqHz = (f_bin + 1) * (sampleRate / effectiveFFTSize);
                const logNextFreq = Math.log(Math.max(currentFreqHz + 0.1, nextFreqHz)); // Ensure arg > 0 for log
                const relativeLogNextPos = (logNextFreq - minLogFreqValue) / logFreqDisplayRange;

                yPos = height * (1 - Math.min(1, Math.max(0, relativeLogNextPos))); 
                binH = height * (Math.min(1, Math.max(0, relativeLogNextPos)) - Math.min(1, Math.max(0, relativeLogPos)));
                if (binH < 1 && binH > 0) binH = 1; 
                else if (binH <= 0) continue; // Skip if not visible or invalid

            } else { // Linear scale
                const binHeightLinear = height / currentSliceFreqData.length;
                yPos = height - (f_bin + 1) * binHeightLinear;
                binH = binHeightLinear;
            }

            const xPos = t * sliceWidth;
            if (yPos < height && yPos + binH > 0 && binH > 0) {
                 ctx.fillRect(Math.floor(xPos), Math.floor(yPos), Math.ceil(sliceWidth), Math.ceil(binH));
            }
        }
    }
}


// --- Signal Statistics ---
function updateSignalStatistics() {
    let sumSq = 0; let peak = 0;
    if (!timeData || timeData.length === 0) { // Handle empty timeData
        statRmsEl.textContent = "N/A"; statPeakEl.textContent = "N/A";
        statCrestEl.textContent = "N/A"; statThdEl.textContent = 'N/A';
        return;
    }
    for (let i = 0; i < timeData.length; i++) {
        sumSq += timeData[i] * timeData[i];
        if (Math.abs(timeData[i]) > peak) peak = Math.abs(timeData[i]);
    }
    const rms = timeData.length > 0 ? Math.sqrt(sumSq / timeData.length) : 0;
    const crestFactor = rms > 1e-9 ? peak / rms : 0; 

    statRmsEl.textContent = rms.toFixed(3);
    statPeakEl.textContent = peak.toFixed(3);
    statCrestEl.textContent = crestFactor.toFixed(3);

    const { index: fundIdx, magnitude: fundMag } = findFundamentalFrequency(freqData);
    let harmonicPowerSum = 0;
    if (fundIdx > 0 && fundMag > 1e-5 && freqData && freqData.length > 0) { // Check freqData
        for (let h = 2; h <= 8; h++) {
            const harmonicBin = fundIdx * h;
            if (harmonicBin < freqData.length) harmonicPowerSum += freqData[harmonicBin] * freqData[harmonicBin];
        }
        const thd = fundMag > 0 ? (Math.sqrt(harmonicPowerSum) / fundMag) * 100 : 0;
        statThdEl.textContent = thd.toFixed(2) + '%';
    } else {
        statThdEl.textContent = 'N/A';
    }
}

// --- Peak Markers for Frequency Chart ---
function updatePeakMarkers() {
    if (!chartInstances.freq || !chartInstances.freq.options || !chartInstances.freq.options.plugins || !freqData) return;

    const numMarkers = 5;
    const peaks = findPeaks(freqData, numMarkers);
    const annotations = {};
    // Determine the FFT size used to generate the current freqData
    const fftInputSize = timeData.length; // This is the N for the FFT


    peaks.forEach((peak, i) => {
        if (peak.magnitude < 0.01) return; // Threshold for visibility
        const peakFreq = peak.index * sampleRate / fftInputSize; // Freq = k * Fs / N
        
        annotations[`peakLine${i}`] = {
            type: 'line', scaleID: 'x', value: peakFreq,
            borderColor: 'rgba(255, 99, 132, 0.6)', borderWidth: 1, borderDash: [5, 5],
            label: {
                content: `${peakFreq.toFixed(0)}Hz`, enabled: true, position: 'start',
                font: { size: 9 }, color: 'white', backgroundColor: 'rgba(255, 99, 132, 0.7)',
                yAdjust: -10 - (i * 5) 
            }
        };
    });
    chartInstances.freq.options.plugins.annotation = { annotations: annotations };
    chartInstances.freq.update('none'); // Update to show annotations
}

// --- Application: Audio Analyzer ---
function updateAudioAnalyzer(newFreqLabels) {
    if (!chartInstances.audioAnalyzer || !freqData) return;
    if (newFreqLabels) chartInstances.audioAnalyzer.data.labels = newFreqLabels;
    chartInstances.audioAnalyzer.data.datasets[0].data = freqData;
    chartInstances.audioAnalyzer.update('none');
}

// --- Application: Filter Demo ---
function applyFilter(inputFreqData) {
    if (!inputFreqData) return new Float32Array(0);
    const filteredData = Float32Array.from(inputFreqData);
    const type = filterTypeSelect.value;
    const cutoffHz = parseFloat(cutoffFrequencySlider.value);
    const bandwidthHz = parseFloat(bandwidthSlider.value);
    
    // Determine the FFT size used to generate inputFreqData
    const fftInputSize = timeData.length; 

    const cutoffBin = Math.round(cutoffHz * fftInputSize / sampleRate); 
    const bandwidthBin = Math.round(bandwidthHz * fftInputSize / sampleRate);


    for (let i = 0; i < filteredData.length; i++) { 
        switch (type) {
            case 'lowpass': if (i > cutoffBin) filteredData[i] = 0; break;
            case 'highpass': if (i < cutoffBin) filteredData[i] = 0; break;
            case 'bandpass':
                const lowerBP = cutoffBin - Math.floor(bandwidthBin / 2);
                const upperBP = cutoffBin + Math.ceil(bandwidthBin / 2);
                if (i < lowerBP || i > upperBP) filteredData[i] = 0;
                break;
            case 'notch':
                const lowerN = cutoffBin - Math.floor(bandwidthBin / 2);
                const upperN = cutoffBin + Math.ceil(bandwidthBin / 2);
                if (i >= lowerN && i <= upperN) filteredData[i] = 0;
                break;
        }
    }
    return filteredData;
}

function updateFilterDemo(newFreqLabels) {
    if (!chartInstances.filterDemo || !freqData) return;
    if (newFreqLabels) chartInstances.filterDemo.data.labels = newFreqLabels;
    const filteredFreqData = applyFilter(freqData);
    chartInstances.filterDemo.data.datasets[0].data = freqData; // Original
    chartInstances.filterDemo.data.datasets[1].data = filteredFreqData; // Filtered
    chartInstances.filterDemo.update('none');
}

// --- Application: Harmonic Analyzer ---
function findFundamentalFrequency(freqDomainData) {
    if (!freqDomainData || freqDomainData.length === 0) return { index: -1, freq: 0, magnitude: 0 };
    let maxMag = 0; let fundamentalIndex = -1;
    for (let i = 1; i < freqDomainData.length; i++) { // Start from 1 to skip DC
        if (freqDomainData[i] > maxMag) {
            maxMag = freqDomainData[i];
            fundamentalIndex = i;
        }
    }
    if (fundamentalIndex === -1) return { index: -1, freq: 0, magnitude: 0 };
    // Determine the FFT size used to generate freqDomainData
    const fftInputSize = timeData.length; 
    const fundamentalFreq = fundamentalIndex * sampleRate / fftInputSize;
    return { index: fundamentalIndex, freq: fundamentalFreq, magnitude: maxMag };
}

function updateHarmonicAnalyzer() {
    if (!chartInstances.harmonicAnalyzer || !freqData) return;
    const { index: fundIdx, magnitude: fundMag } = findFundamentalFrequency(freqData);
    const harmonicMagnitudes = new Array(8).fill(0);

    if (fundIdx > 0 && fundMag > 1e-5) { // Check if a fundamental was found and is significant
        harmonicMagnitudes[0] = 1.0; // Fundamental relative strength is 1

        for (let h = 2; h <= 8; h++) { // Harmonics 2nd to 8th
            const harmonicIndex = fundIdx * h;
            if (harmonicIndex < freqData.length) {
                const harmonicMag = freqData[harmonicIndex];
                harmonicMagnitudes[h - 1] = fundMag > 0 ? harmonicMag / fundMag : 0; // Relative to fundamental
            } else {
                harmonicMagnitudes[h - 1] = 0; // Harmonic is beyond Nyquist or data length
            }
        }
    }
    chartInstances.harmonicAnalyzer.data.datasets[0].data = harmonicMagnitudes;
    chartInstances.harmonicAnalyzer.update('none');
}

 // --- Component Breakdown ---
function updateComponentBreakdown(newTimeLabels) {
    if (!chartInstances.component || !freqData || !phaseData || !timeData) return;
    if (newTimeLabels) chartInstances.component.data.labels = newTimeLabels;
    
    const numComponentsToShow = 5;
    const peaks = findPeaks(freqData, numComponentsToShow);
    const datasets = [];
    const isDark = document.body.classList.contains('dark-theme');
    const baseColors = ['#E63946', '#0077B6', '#5cb85c', '#F7B801', '#9B5DE5'];
    const colors = baseColors.map(c => isDark ? lightenColor(c, 30) : c);

    chartInstances.component.data.datasets = []; // Clear existing

    // Determine the FFT size used to generate freqData/phaseData
    const fftInputSize = timeData.length; 
    const componentTimeArrayLength = timeData.length; // Reconstruct component wave over current timeData length

    peaks.forEach((peak, index) => {
        if (peak.magnitude > 1e-4) { // Only show significant peaks
             const freq = peak.index * sampleRate / fftInputSize;
             const amp = peak.magnitude; // Amplitude from our normalized FFT
             const componentPhase = (peak.index < phaseData.length) ? phaseData[peak.index] : 0;

             const componentWave = new Float32Array(componentTimeArrayLength);
             addSignalComponent(componentWave, 'sine', freq, amp, componentPhase);

             datasets.push({
                label: `Freq ${freq.toFixed(1)} Hz (A:${amp.toFixed(2)})`,
                data: componentWave,
                borderColor: colors[index % colors.length],
                borderWidth: 1.5, pointRadius: 0, fill: false
             });
        }
    });
    chartInstances.component.data.datasets = datasets;
    chartInstances.component.update('none');
}

function lightenColor(hex, percent) { 
    hex = String(hex).replace(/^\s*#|\s*$/g, '');
    if(hex.length == 3) hex = hex.replace(/(.)/g, '$1$1');
    let r = parseInt(hex.substr(0, 2), 16), g = parseInt(hex.substr(2, 2), 16), b = parseInt(hex.substr(4, 2), 16);
    percent = Math.max(-100, Math.min(100, percent)); // cap percent
    r = Math.round(Math.min(255, Math.max(0, r + (255 * percent / 100))));
    g = Math.round(Math.min(255, Math.max(0, g + (255 * percent / 100))));
    b = Math.round(Math.min(255, Math.max(0, b + (255 * percent / 100))));
    const rr = r.toString(16).padStart(2, '0');
    const gg = g.toString(16).padStart(2, '0');
    const bb = b.toString(16).padStart(2, '0');
    return `#${rr}${gg}${bb}`;
}


function findPeaks(data, count) {
    if (!data || data.length === 0) return [];
    const peaks = [];
    for (let i = 1; i < data.length - 1; i++) { // Skip DC and last bin
        if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
            peaks.push({ index: i, magnitude: data[i] });
        }
    }
    peaks.sort((a, b) => b.magnitude - a.magnitude);
    return peaks.slice(0, count);
}

// --- Import/Export ---
function exportTimeDataAsCSV() {
    if (!timeData || timeData.length === 0) { alert("No time data to export."); return; }
    let csvContent = "data:text/csv;charset=utf-8,Time (s),Amplitude\n";
    const timeStep = globalSignalDuration / timeData.length;
    timeData.forEach((val, index) => {
        const timePoint = index * timeStep;
        csvContent += `${timePoint.toFixed(6)},${val.toFixed(6)}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "time_domain_signal.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function exportFreqDataAsCSV() {
    if (!freqData || freqData.length === 0 || !phaseData || phaseData.length === 0) {
        alert("No frequency/phase data to export."); return;
    }
    let csvContent = "data:text/csv;charset=utf-8,Frequency (Hz),Magnitude,Phase (rad)\n";
    const fftInputSize = timeData.length; // FFT was performed on timeData
    for (let i = 0; i < freqData.length; i++) {
        const freqPoint = i * sampleRate / fftInputSize;
        const phaseVal = (i < phaseData.length) ? phaseData[i].toFixed(6) : "N/A";
        csvContent += `${freqPoint.toFixed(2)},${freqData[i].toFixed(6)},${phaseVal}\n`;
    }
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "frequency_domain_signal.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (isRecording) await toggleMicrophoneInput(); // Stop mic if running

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.csv')) parseCSVFile(file);
    else if (fileName.endsWith('.wav')) parseWAVFile(file);
    else alert('Unsupported file type. Please upload WAV or CSV.');
    event.target.value = null; // Reset file input to allow re-uploading same file
}

function parseCSVFile(file) {
    const reader = new FileReader();
    reader.onload = (e_csv) => {
        const text = e_csv.target.result;
        const lines = text.split('\n').map(line => line.trim()).filter(line => line && !/^\s*(time|frequency|#)/i.test(line)); // Basic header/comment skip
        const newTimeDataValues = []; let maxTime = 0;

        lines.forEach(line => {
            const parts = line.split(/[,;\s\t]+/); // Allow various delimiters
            if (parts.length >= 2) {
                const timeVal = parseFloat(parts[0]); const ampVal = parseFloat(parts[1]);
                if (!isNaN(timeVal) && !isNaN(ampVal)) {
                    newTimeDataValues.push({time: timeVal, amp: ampVal});
                    if (timeVal > maxTime) maxTime = timeVal;
                }
            }
        });
        
        if (newTimeDataValues.length > 0) {
            globalSignalDuration = maxTime > 0 ? maxTime : 1.0;
            
            // Resample CSV data to fit `bufferSize` (visual buffer)
            const visualBufferSize = 1024; // Use a fixed visual buffer size for CSV display consistency
            timeData = new Float32Array(visualBufferSize);

            if (newTimeDataValues.length === 1) { // Single point CSV
                timeData.fill(newTimeDataValues[0].amp);
            } else {
                // Simple resampling: find nearest or could implement linear interpolation
                for (let i = 0; i < visualBufferSize; i++) {
                    const targetTime = (i / (visualBufferSize -1)) * globalSignalDuration;
                    let closestIdx = 0;
                    let minDist = Infinity;
                    for(let j=0; j<newTimeDataValues.length; j++) {
                        const dist = Math.abs(newTimeDataValues[j].time - targetTime);
                        if(dist < minDist) { minDist = dist; closestIdx = j; }
                        else if (dist > minDist) break; // Optimization: if distance starts increasing
                    }
                    timeData[i] = newTimeDataValues[closestIdx].amp;
                }
            }
            // Update effective sample rate based on resampled data
            sampleRate = Math.max(100, Math.floor(visualBufferSize / globalSignalDuration)); 
            bufferSize = visualBufferSize; // Align global bufferSize for consistency if CSV is loaded
            
            updateSliderMaxFreq();
            performFFTAndUpdate();
            alert(`CSV imported. ${newTimeDataValues.length} points read. Signal duration: ${globalSignalDuration.toFixed(2)}s. Displayed with ${visualBufferSize} samples at effective Sample Rate: ${sampleRate} Hz.`);
        } else alert('Could not parse CSV data. Expected format (e.g.): time,amplitude');
    };
    reader.readAsText(file);
}

async function parseWAVFile(file) {
    if (!audioContext || audioContext.state === 'closed') {
         audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const reader = new FileReader();
    reader.onload = async (e_wav) => {
        try {
            const audioBuffer = await audioContext.decodeAudioData(e_wav.target.result);
            const channelData = audioBuffer.getChannelData(0); // Use first channel
            sampleRate = audioBuffer.sampleRate;
            globalSignalDuration = audioBuffer.duration;
            
            // For WAV, use a portion of the data that fits into the visual buffer
            const visualBufferSize = 1024;
            timeData = new Float32Array(visualBufferSize);
            const samplesToCopy = Math.min(channelData.length, visualBufferSize);
            for(let i=0; i < samplesToCopy; i++) timeData[i] = channelData[i];
            if (samplesToCopy < visualBufferSize) { // Pad with zeros if WAV is shorter than visual buffer
                for(let i=samplesToCopy; i < visualBufferSize; i++) timeData[i] = 0;
            }
            bufferSize = visualBufferSize; // Align global bufferSize
            
            updateSliderMaxFreq();
            performFFTAndUpdate();
            alert(`WAV file imported. Sample Rate: ${sampleRate} Hz. Duration: ${globalSignalDuration.toFixed(2)}s. Displayed first ${visualBufferSize} samples.`);
        } catch (err) {
            console.error('Error decoding WAV file:', err);
            alert('Error decoding WAV file. It might be corrupted or in an unsupported format.');
        }
    };
    reader.readAsArrayBuffer(file);
}

// --- Waterfall Plot (Placeholder) ---
function drawWaterfall() {
    const canvas = waterfallChartCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0, canvas.width, canvas.height); // Clear with current background
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--card-bg');
    ctx.fillRect(0,0, canvas.width, canvas.height);

    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-color');
    ctx.textAlign = 'center';
    ctx.font = "14px 'Segoe UI'";
    ctx.fillText('Waterfall Plot (3D Spectrogram) - Placeholder', canvas.width/2, canvas.height/2 -10);
    ctx.font = "12px 'Segoe UI'";
    ctx.fillText('Requires a 3D graphics library (e.g., Three.js) for full implementation.', canvas.width/2, canvas.height/2 + 10);
}
