# Quill Speech-to-Text Module

A modern speech recognition module for the [Quill](https://quilljs.com/) rich text editor that adds speech input capabilities with a moderately beautiful UI.

## Features

- 🎤 Native browser Speech Recognition API support
- 📝 Insert speech as text at cursor position
- 📊 Moderately beautiful audio visualization during recording with customizable colors
- 🔌 Extensible with custom speech recognition processors
- 🌐 Support for multiple languages
- 🔄 Continuous recording mode option
- 🎨 Modern and responsive UI

## Installation

```bash
npm install quill-stt --save
# or
yarn add quill-stt
```

## Usage

```javascript
// Import Quill and the module
import Quill from 'quill';
import 'quill-stt';

// Initialize Quill with the module
const quill = new Quill('#editor', {
  theme: 'snow',
  modules: {
    toolbar: [
      ['bold', 'italic', 'underline'],
      ['image', 'code-block']
    ],
    speechToText: {
      language: 'en-US',
      continuous: false,
      visualizer: true,
      waveformColor: '#4285f4', 
      histogramColor: '#25D366' 
    }
  }
});
```

## Configuration Options

The speech-to-text module accepts the following options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `position` | String | `'bottom'` | Position of the speech input toolbar. Can be `'bottom'` or `'top'`. |
| `language` | String | `'en-US'` | Language for speech recognition. Use BCP 47 language tags like `'en-US'`, `'fr-FR'`, `'es-ES'`. |
| `continuous` | Boolean | `false` | Whether to keep recording after results are finalized. |
| `visualizer` | Boolean | `true` | Show audio visualizer during recording. |
| `waveformColor` | String | `'#4285f4'` | Color of the waveform line in the audio visualizer. Can be any valid CSS color. |
| `histogramColor` | String | `'#25D366'` | Color of the histogram bars in the audio visualizer. Can be any valid CSS color. |
| `interimResults` | Boolean | `true` | Show interim results during speech recognition. |
| `customProcessor` | Object | `null` | Custom processor for speech recognition (see below). |

## Events

You can subscribe to events from the speech-to-text module:

```javascript
const speechToText = quill.getModule('speechToText');

speechToText.on('onStart', () => {
  console.log('Recording started');
});

speechToText.on('onResult', (data) => {
  console.log(`Received ${data.isFinal ? 'final' : 'interim'} result: "${data.transcript}"`);
});

speechToText.on('onEnd', () => {
  console.log('Recording stopped');
});

speechToText.on('onError', (error) => {
  console.error('Speech recognition error:', error);
});
```

## Using a Custom Speech Processor

If you want to use a custom speech recognition service (like OpenAI's Whisper API), you can provide a custom processor:

```javascript
const quill = new Quill('#editor', {
  // ...other options
  modules: {
    // ...other modules
    speechToText: {
      customProcessor: {
        // Will be called when recording starts
        start() {
          // Your code to start audio recording
          // For example, connect to WebSocket for streaming to a Whisper API endpoint
        },
        
        // Will be called when recording stops
        stop() {
          // Your code to stop audio recording
        },
        
        // These will be set by the module
        onResult: null, // Call this with (transcript, isFinal) when results are available
        onEnd: null,    // Call this when processing ends
        onError: null   // Call this with error object when an error occurs
      }
    }
  }
});
```

## Browser Compatibility

This module uses the Web Speech API, which is supported in most modern browsers like Chrome, Edge, Safari, and Firefox. See [browser compatibility](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition#browser_compatibility) for more details.

If the Speech Recognition API is not available in the browser, you can provide a custom speech processor to use a different service.

## Development

To run the development server:

```bash
npm start
```

To build for production:

```bash
npm run build
```

## License

MIT
