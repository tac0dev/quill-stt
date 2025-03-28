import Quill from 'quill';
import './styles.css';

// SpeechToText module for Quill
class SpeechToText {
  constructor(quill, options = {}) {
    this.quill = quill;
    this.options = {
      // Default options
      position: 'bottom',
      visualizer: true,
      language: 'en-US',
      continuous: false,
      interimResults: true,
      customProcessor: null,
      waveformColor: '#4285f4',
      histogramColor: '#25D366',
      ...options
    };

    this.isRecording = false;
    this.recognition = null;
    this.customProcessor = this.options.customProcessor;
    this.events = {
      onStart: [],
      onResult: [],
      onEnd: [],
      onError: []
    };

    // Initialize browser's SpeechRecognition if available
    this.initSpeechRecognition();
    
    // Create toolbar UI
    this.createUI();
  }

  // Initialize the SpeechRecognition API if available
  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition && !this.customProcessor) {
      console.warn('SpeechRecognition API is not supported by this browser and no custom processor provided.');
      return;
    }

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = this.options.continuous;
      this.recognition.interimResults = this.options.interimResults;
      this.recognition.lang = this.options.language;

      this.recognition.onstart = () => {
        this.isRecording = true;
        this.updateUI();
        this.triggerEvent('onStart');
      };

      this.recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript;
        const isFinal = result.isFinal;
        
        this.processResult(transcript, isFinal);
        this.triggerEvent('onResult', { transcript, isFinal });
      };

      this.recognition.onend = () => {
        // Don't set isRecording to false if it was stopped programmatically
        // and continuous mode is enabled
        if (!this.options.continuous || !this.isRecording) {
          this.isRecording = false;
          this.updateUI();
          this.stopVisualization();
          this.stopTimer();
        } else if (this.isRecording) {
          // Restart if it ended automatically but we're in continuous mode
          this.recognition.start();
        }
        this.triggerEvent('onEnd');
      };

      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        this.isRecording = false;
        this.updateUI();
        this.stopVisualization();
        this.stopTimer();
        this.triggerEvent('onError', event);
      };
    }
  }

  // Create the speech-to-text UI elements
  createUI() {
    // Create container
    this.container = document.createElement('div');
    this.container.className = 'ql-stt-container';
    
    // Create the integrated mic-visualizer container
    if (this.options.visualizer) {
      // Create the outer container that will hold both mic and visualizer
      this.visualizerContainer = document.createElement('div');
      this.visualizerContainer.className = 'ql-stt-visualizer-container';
      
      // Create visualizer canvas
      this.visualizerCanvas = document.createElement('canvas');
      this.visualizerCanvas.className = 'ql-stt-visualizer';
      this.visualizerCanvas.width = 300; // Wider canvas to accommodate both visualizations
      this.visualizerCanvas.height = 50; // Slightly taller for better visualization
      
      // Create microphone button
      this.micButton = document.createElement('button');
      this.micButton.className = 'ql-stt-mic-button';
      this.micButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"></path></svg>';
      this.micButton.addEventListener('click', () => this.toggleRecording());
      
      // Add elements to the container (order matters for positioning)
      this.visualizerContainer.appendChild(this.visualizerCanvas);
      this.visualizerContainer.appendChild(this.micButton);
      this.container.appendChild(this.visualizerContainer);
      
      // Initialize audio visualizer
      this.initAudioVisualizer();
    } else {
      // If visualizer is disabled, just add the mic button directly to container
      this.micButton = document.createElement('button');
      this.micButton.className = 'ql-stt-mic-button standalone';
      this.micButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"></path></svg>';
      this.micButton.addEventListener('click', () => this.toggleRecording());
      this.container.appendChild(this.micButton);
    }

    // Create recording timer
    this.recordingTimer = document.createElement('div');
    this.recordingTimer.className = 'ql-stt-timer';
    this.recordingTimer.textContent = '00:00';
    this.container.appendChild(this.recordingTimer);
    

    // Append container to the editor
    if (this.options.position === 'bottom') {
      this.quill.container.appendChild(this.container);
    } else if (this.options.position === 'top') {
      this.quill.container.insertBefore(this.container, this.quill.container.firstChild);
    }

    // Initial UI update
    this.updateUI();
  }

  // Initialize audio visualizer
  initAudioVisualizer() {
    this.audioContext = null;
    this.analyser = null;
    this.waveformDataArray = null;
    this.frequencyDataArray = null;
    this.visualizerCtx = this.visualizerCanvas.getContext('2d');
    this.animationFrame = null;
    this.recordingStartTime = 0;
    this.timerInterval = null;
    
    // For histogram history - no max limit now, we keep everything
    this.histogramHistory = [];
  }

  // Start audio visualization
  startVisualization(stream) {
    if (!this.options.visualizer || !stream) return;

    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
  
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512; // Increase for better resolution
      this.analyser.smoothingTimeConstant = 0.8; // Add smoothing
      source.connect(this.analyser);
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.waveformDataArray = new Uint8Array(bufferLength);
      this.frequencyDataArray = new Uint8Array(bufferLength);
      
      // Initialize time for taking histogram snapshots
      this.lastHistogramUpdateTime = Date.now();
      this.histogramUpdateInterval = 200; // Update histogram every 200ms
      
      const draw = () => {
        if (!this.isRecording) return;
        
        this.animationFrame = requestAnimationFrame(draw);
        
        // Get waveform data for the waveform visualization
        this.analyser.getByteTimeDomainData(this.waveformDataArray);
        
        // Get frequency data for the histogram
        this.analyser.getByteFrequencyData(this.frequencyDataArray);
        
        // Clear the canvas
        this.visualizerCtx.clearRect(0, 0, this.visualizerCanvas.width, this.visualizerCanvas.height);
        
        // Draw the combined visualization
        this.drawCombinedVisualization();
        
        // Update histogram history
        const currentTime = Date.now();
        if (currentTime - this.lastHistogramUpdateTime >= this.histogramUpdateInterval) {
          this.updateHistogramHistory();
          this.lastHistogramUpdateTime = currentTime;
        }
      };
      
      draw();
    } catch (error) {
      console.error('Error starting audio visualization:', error);
    }
  }
  
  // Draw combined visualization with waveform and histogram
  drawCombinedVisualization() {
    const width = this.visualizerCanvas.width;
    const height = this.visualizerCanvas.height;
    const ctx = this.visualizerCtx;
    
    // 1. Draw the histogram background first (WhatsApp style)
    this.drawHistogramBackground();
    
    // 2. Draw the waveform on top
    this.drawWaveform();
  }
  
  // Draw the waveform visualization
  drawWaveform() {
    const width = this.visualizerCanvas.width;
    const height = this.visualizerCanvas.height;
    const ctx = this.visualizerCtx;
    const bufferLength = this.waveformDataArray.length;
    
    // Set line style
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.options.waveformColor; // Configurable waveform color
    
    // Draw the waveform
    ctx.beginPath();
    
    const sliceWidth = width / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const v = this.waveformDataArray[i] / 128.0; // Convert to range [0, 2]
      const y = v * height / 2;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }
  
  // Update histogram history with current frequency data
  updateHistogramHistory() {
    // Create a snapshot of the current frequency data
    const bufferLength = this.frequencyDataArray.length;
    const barCount = 32; // Number of frequency bars to sample
    const samplingStep = Math.floor(bufferLength / barCount);
    
    // Create a summarized snapshot
    const snapshot = [];
    for (let i = 0; i < barCount; i++) {
      const dataIndex = i * samplingStep;
      // Use sqrt scaling for better visual range
      const value = Math.sqrt(this.frequencyDataArray[dataIndex] / 255) * 255;
      snapshot.push(value);
    }
    
    // Add to history - keep all snapshots for full recording visualization
    this.histogramHistory.push(snapshot);
  }
  
  // Draw the histogram background
  drawHistogramBackground() {
    const width = this.visualizerCanvas.width;
    const height = this.visualizerCanvas.height;
    const ctx = this.visualizerCtx;
    
    // Return if no history yet
    if (!this.histogramHistory.length) return;
    
    // Calculate bar width based on history length to ensure all data is visible
    const barCount = this.histogramHistory[0].length;
    const historyLength = this.histogramHistory.length;
    
    // Dynamically calculate the bar width to fit the entire recording
    // Minimum width of 1 pixel ensures we always see something
    const barWidth = Math.max(1, width / historyLength);
    const barSpacing = 0; // No spacing for continuous effect
    
    // Maximum height for the bars (70% of canvas height)
    const maxBarHeightPercent = 0.7;
    const maxBarPixelHeight = height * maxBarHeightPercent;
    
    // Draw each column of history (time moves right)
    for (let timeIndex = 0; timeIndex < historyLength; timeIndex++) {
      const snapshot = this.histogramHistory[timeIndex];
      
      // Calculate x position for this time slice - start from left
      const x = timeIndex * barWidth;
      
      // For each frequency bar in this time slice
      for (let freqIndex = 0; freqIndex < barCount; freqIndex++) {
        const value = snapshot[freqIndex];
        
        // Calculate height of this frequency bar
        const barHeight = (value / 255) * maxBarPixelHeight;
        
        // Calculate y position (vertically centered)
        const y = (height - barHeight) / 2;
        
        // Extract RGB components from the histogram color for the gradient
        const histogramColor = this.options.histogramColor;
        let r, g, b;
        
        // Parse the histogram color (handles both hex and rgb formats)
        if (histogramColor.startsWith('#')) {
          // Hex color
          const hex = histogramColor.slice(1);
          r = parseInt(hex.substring(0, 2), 16);
          g = parseInt(hex.substring(2, 4), 16);
          b = parseInt(hex.substring(4, 6), 16);
        } else if (histogramColor.startsWith('rgb')) {
          // RGB color
          const rgbValues = histogramColor.match(/\d+/g);
          if (rgbValues && rgbValues.length >= 3) {
            r = parseInt(rgbValues[0]);
            g = parseInt(rgbValues[1]);
            b = parseInt(rgbValues[2]);
          } else {
            // Fallback if parsing fails
            r = 37; g = 211; b = 102; // Default green
          }
        } else {
          // Fallback for other formats
          r = 37; g = 211; b = 102; // Default green
        }
        
        const intensity = value / 255;
        const opacity = 0.2 + (intensity * 0.6); // More intense = more opaque
        
        // Set color based on intensity with the configurable color
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        
        // Draw the bar
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    }
  }

  // Stop audio visualization
  stopVisualization() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    if (this.visualizerCtx) {
      this.visualizerCtx.clearRect(0, 0, this.visualizerCanvas.width, this.visualizerCanvas.height);
    }
    
    // Clear histogram history
    this.histogramHistory = [];
    
    // Release audio resources
    this.releaseAudioResources();
    
    // Stop the timer
    this.stopTimer();
  }
  
  // Release audio resources to stop the microphone indicator
  releaseAudioResources() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
    }
    
    // Close audio context if possible
    if (this.audioContext && this.audioContext.state !== 'closed' && typeof this.audioContext.close === 'function') {
      try {
        this.audioContext.close();
      } catch (e) {
        console.error('Error closing audio context:', e);
      }
      this.audioContext = null;
      this.analyser = null;
    }
  }
  
  // Start the recording timer
  startTimer() {
    this.recordingStartTime = Date.now();
    this.updateTimer();
    
    this.timerInterval = setInterval(() => {
      this.updateTimer();
    }, 1000); // Update every second
  }
  
  // Stop the recording timer
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.recordingTimer.textContent = '00:00';
  }
  
  // Update the timer display
  updateTimer() {
    const elapsedTime = Date.now() - this.recordingStartTime;
    const seconds = Math.floor((elapsedTime / 1000) % 60);
    const minutes = Math.floor((elapsedTime / (1000 * 60)) % 60);
    
    this.recordingTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Toggle recording state
  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  // Start recording
  startRecording() {
    if (this.isRecording) return;
    
    if (this.recognition) {
      try {
        this.recognition.start();
        this.isRecording = true;
        this.updateUI();
        this.startTimer();
        
        if (this.options.visualizer) {
          navigator.mediaDevices.getUserMedia({ 
            audio: { 
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true 
            }, 
            video: false 
          })
            .then(stream => {
              this.stream = stream;
              this.startVisualization(stream);
            })
            .catch(err => {
              console.error('Error accessing microphone:', err);
            });
        }
      } catch (error) {
        console.error('Error starting speech recognition:', error);
      }
    } else if (this.customProcessor) {
      this.isRecording = true;
      this.updateUI();
      this.startTimer();
      this.triggerEvent('onStart');
      this.customProcessor.start();
    }
  }

  // Stop recording
  stopRecording() {
    if (!this.isRecording) return;
    
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    } else if (this.customProcessor) {
      this.customProcessor.stop();
    }
    
    this.isRecording = false;
    this.updateUI();
    this.stopVisualization(); // This now calls releaseAudioResources
  }

  // Process the speech recognition result
  processResult(transcript, isFinal) {
    if (!transcript) return;
    
    const selection = this.quill.getSelection();
    const index = selection ? selection.index : this.quill.getLength() - 1;
    
    if (isFinal) {
      // Add a space at the end if needed
      if (!transcript.endsWith(' ')) {
        transcript += ' ';
      }
      
      // Insert at current cursor position
      this.quill.insertText(index, transcript, 'user');
      this.quill.setSelection(index + transcript.length, 0);
    }
  }

  // Update UI based on recording state
  updateUI() {
    if (this.isRecording) {
      this.micButton.classList.add('recording');
      if (this.options.visualizer) {
        this.visualizerContainer.classList.add('recording');
      }
      this.recordingTimer.classList.add('recording');
      if (this.statusIndicator) {
        this.statusIndicator.textContent = 'Listening...';
        this.statusIndicator.classList.add('recording');
      }
    } else {
      this.micButton.classList.remove('recording');
      if (this.options.visualizer) {
        this.visualizerContainer.classList.remove('recording');
      }
      this.recordingTimer.classList.remove('recording');
      if (this.statusIndicator) {
        this.statusIndicator.textContent = 'Click microphone to start';
        this.statusIndicator.classList.remove('recording');
      }
    }
  }

  // Event handling
  on(event, callback) {
    if (this.events[event]) {
      this.events[event].push(callback);
    }
    return this;
  }

  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
    return this;
  }

  triggerEvent(event, data = {}) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }
  }

  // Set a custom speech processor
  setCustomProcessor(processor) {
    this.customProcessor = processor;
    
    // Make sure to connect events
    if (processor && typeof processor === 'object') {
      if (processor.onResult) {
        processor.onResult = (transcript, isFinal) => {
          this.processResult(transcript, isFinal);
          this.triggerEvent('onResult', { transcript, isFinal });
        };
      }
      
      if (processor.onEnd) {
        processor.onEnd = () => {
          this.isRecording = false;
          this.updateUI();
          this.triggerEvent('onEnd');
        };
      }
      
      if (processor.onError) {
        processor.onError = (error) => {
          this.isRecording = false;
          this.updateUI();
          this.triggerEvent('onError', error);
        };
      }
    }
  }
}

// Register as a Quill module
Quill.register('modules/speechToText', SpeechToText);

export default SpeechToText;
