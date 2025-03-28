import Quill from 'quill';
import '../../src/index.js';
import '../../src/styles.css';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Quill with the Speech-to-Text module
  const quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ 'header': 1 }, { 'header': 2 }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['clean']
      ],
      speechToText: {
        language: 'en-US',
        continuous: false,
        visualizer: true,
        waveformColor: '#4285f4',
        histogramColor: '#25D366'
      }
    },
    placeholder: 'Start typing or use the microphone button below...'
  });

  // Get reference to the Speech-to-Text module instance
  const speechToText = quill.getModule('speechToText');
  
  // Get references to UI elements
  const languageSelect = document.getElementById('language');
  const continuousCheckbox = document.getElementById('continuous');
  const visualizerCheckbox = document.getElementById('visualizer');
  const waveformColorPicker = document.getElementById('waveform-color');
  const histogramColorPicker = document.getElementById('histogram-color');
  const customProcessorBtn = document.getElementById('custom-processor-btn');
  const resetBtn = document.getElementById('reset-btn');
  const statusEl = document.getElementById('status');
  
  // Event handlers for UI controls
  languageSelect.addEventListener('change', (e) => {
    speechToText.recognition.lang = e.target.value;
    updateStatus(`Language changed to ${e.target.value}`);
  });
  
  continuousCheckbox.addEventListener('change', (e) => {
    speechToText.options.continuous = e.target.checked;
    if (speechToText.recognition) {
      speechToText.recognition.continuous = e.target.checked;
    }
    updateStatus(`Continuous mode ${e.target.checked ? 'enabled' : 'disabled'}`);
  });
  
  visualizerCheckbox.addEventListener('change', (e) => {
    const visualizerContainer = document.querySelector('.ql-stt-visualizer-container');
    if (visualizerContainer) {
      visualizerContainer.style.display = e.target.checked ? 'block' : 'none';
    }
    speechToText.options.visualizer = e.target.checked;
    updateStatus(`Visualizer ${e.target.checked ? 'shown' : 'hidden'}`);
  });
  
  // Event listeners for color pickers
  waveformColorPicker.addEventListener('input', (e) => {
    speechToText.options.waveformColor = e.target.value;
    updateStatus(`Waveform color changed to ${e.target.value}`);
  });
  
  histogramColorPicker.addEventListener('change', (e) => {
    speechToText.options.histogramColor = e.target.value;
    updateStatus(`Histogram color changed to ${e.target.value}`);
  });
  
  resetBtn.addEventListener('click', () => {
    quill.setText('');
    updateStatus('Editor content reset');
  });
  
  // Implement a custom processor (simulated, as an example)
  customProcessorBtn.addEventListener('click', () => {
    const isUsingCustom = customProcessorBtn.classList.toggle('active');
    
    if (isUsingCustom) {
      // Create a simulated custom processor
      const customProcessor = {
        isRunning: false,
        simulationInterval: null,
        
        // These will be overridden by the SpeechToText module
        onResult: null,
        onEnd: null,
        onError: null,
        
        // Start the custom processor
        start() {
          this.isRunning = true;
          
          // Simulate speech recognition with random phrases
          const phrases = [
            "This is a simulated result from a custom processor.",
            "You could connect this to a custom API like Whisper.",
            "The audio data would be sent to your backend for processing.",
            "Then the text would be returned and displayed here.",
            "This demonstrates how to implement your own STT solution."
          ];
          
          let phraseIndex = 0;
          let wordIndex = 0;
          
          this.simulationInterval = setInterval(() => {
            if (!this.isRunning) {
              clearInterval(this.simulationInterval);
              return;
            }
            
            const currentPhrase = phrases[phraseIndex].split(' ');
            const partialPhrase = currentPhrase.slice(0, wordIndex + 1).join(' ');
            
            // Simulate interim results
            this.onResult(partialPhrase, wordIndex === currentPhrase.length - 1);
            
            wordIndex++;
            
            if (wordIndex >= currentPhrase.length) {
              wordIndex = 0;
              phraseIndex = (phraseIndex + 1) % phrases.length;
              
              // Add a pause between phrases
              clearInterval(this.simulationInterval);
              setTimeout(() => {
                if (this.isRunning) {
                  this.simulationInterval = setInterval(this.simulationInterval._onInterval, 500);
                }
              }, 2000);
            }
          }, 500);
          
          // Store reference to the interval callback
          this.simulationInterval._onInterval = this.simulationInterval._onInterval || this.simulationInterval._callback;
        },
        
        // Stop the custom processor
        stop() {
          this.isRunning = false;
          clearInterval(this.simulationInterval);
          if (this.onEnd) this.onEnd();
        }
      };
      
      // Set the custom processor
      speechToText.setCustomProcessor(customProcessor);
      customProcessorBtn.textContent = 'Switch to Browser API';
      updateStatus('Using custom processor (simulated)');
    } else {
      // Revert to browser API
      speechToText.setCustomProcessor(null);
      speechToText.initSpeechRecognition();
      customProcessorBtn.textContent = 'Use Custom Processor (Simulated)';
      updateStatus('Using browser Speech Recognition API');
    }
  });
  
  // Connect to speech-to-text events for the demo
  speechToText.on('onStart', () => {
    updateStatus('Recording started');
  });
  
  speechToText.on('onResult', (data) => {
    updateStatus(`Received ${data.isFinal ? 'final' : 'interim'} result: "${data.transcript}"`);
  });
  
  speechToText.on('onEnd', () => {
    updateStatus('Recording stopped');
  });
  
  speechToText.on('onError', (error) => {
    updateStatus(`Error: ${error.message || error.error || 'Unknown error'}`);
  });
  
  // Helper function to update status message
  function updateStatus(message) {
    statusEl.textContent = message;
    
    // Clear status after 5 seconds
    setTimeout(() => {
      if (statusEl.textContent === message) {
        statusEl.textContent = '';
      }
    }, 5000);
  }
  
  // Set initial content
  quill.setText('Welcome to the Quill Speech-to-Text demo!\n\nClick the microphone button below to start dictating. Your speech will be converted to text and inserted at the cursor position.\n\nYou can customize the visualization colors using the color pickers above. You can also adjust the language, enable continuous mode, or try the simulated custom processor example.');
});
