// Real-Time Speech Translator Application
class SpeechTranslator {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.transcriptHistory = [];
        this.currentTranscript = '';
        this.silenceTimer = null;
        this.speakerId = 1;
        this.connectionType = 'WebSocket';
        this.latency = 0;

        this.initializeElements();
        this.initializeSpeechRecognition();
        this.bindEvents();
        this.updateStatus('Ready to start', 'ready');
    }

    initializeElements() {
        // Control buttons
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.exportBtn = document.getElementById('exportBtn');

        // Language selectors
        this.sourceLanguage = document.getElementById('sourceLanguage');
        this.targetLanguage = document.getElementById('targetLanguage');

        // Status elements
        this.statusText = document.getElementById('statusText');
        this.statusDot = document.querySelector('.status-dot');
        this.connectionTypeEl = document.getElementById('connectionType');
        this.latencyEl = document.getElementById('latency');

        // Caption elements
        this.originalText = document.getElementById('originalText');
        this.translatedText = document.getElementById('translatedText');
        this.transcriptList = document.getElementById('transcriptList');

        // Settings
        this.punctuationToggle = document.getElementById('punctuationToggle');
        this.silenceDetection = document.getElementById('silenceDetection');
        this.speakerDiarization = document.getElementById('speakerDiarization');
        this.captionDelay = document.getElementById('captionDelay');

        // Overlay elements
        this.captionOverlay = document.getElementById('captionOverlay');
        this.overlayOriginal = document.getElementById('overlayOriginal');
        this.overlayTranslated = document.getElementById('overlayTranslated');
        this.closeOverlay = document.getElementById('closeOverlay');
    }

    initializeSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.updateStatus('Speech recognition not supported in this browser', 'error');
            this.startBtn.disabled = true;
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this.sourceLanguage.value;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateStatus('Listening...', 'listening');
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.statusDot.classList.add('listening');
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.updateStatus('Stopped listening', 'ready');
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.statusDot.classList.remove('listening');
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.updateStatus(`Error: ${event.error}`, 'error');
            this.statusDot.classList.add('error');
            setTimeout(() => this.statusDot.classList.remove('error'), 3000);
        };

        this.recognition.onresult = (event) => {
            this.handleSpeechResult(event);
        };
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startListening());
        this.stopBtn.addEventListener('click', () => this.stopListening());
        this.clearBtn.addEventListener('click', () => this.clearTranscript());
        this.exportBtn.addEventListener('click', () => this.exportTranscript());
        this.closeOverlay.addEventListener('click', () => this.hideOverlay());

        this.sourceLanguage.addEventListener('change', () => {
            if (this.recognition) {
                this.recognition.lang = this.sourceLanguage.value;
            }
        });

        // Settings change handlers
        this.punctuationToggle.addEventListener('change', () => this.updateSettings());
        this.silenceDetection.addEventListener('change', () => this.updateSettings());
        this.speakerDiarization.addEventListener('change', () => this.updateSettings());
        this.captionDelay.addEventListener('change', () => this.updateSettings());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case ' ': // Ctrl/Cmd + Space
                        e.preventDefault();
                        if (this.isListening) {
                            this.stopListening();
                        } else {
                            this.startListening();
                        }
                        break;
                    case 'e': // Ctrl/Cmd + E
                        e.preventDefault();
                        this.exportTranscript();
                        break;
                }
            }
        });
    }

    async startListening() {
        try {
            await this.recognition.start();
            this.updateConnectionInfo();
        } catch (error) {
            console.error('Failed to start recognition:', error);
            this.updateStatus('Failed to start recognition', 'error');
        }
    }

    stopListening() {
        if (this.recognition) {
            this.recognition.stop();
        }
    }

    handleSpeechResult(event) {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        if (finalTranscript) {
            this.processFinalTranscript(finalTranscript);
        }

        if (interimTranscript) {
            this.showInterimTranscript(interimTranscript);
        }
    }

    async processFinalTranscript(transcript) {
        const startTime = performance.now();

        // Restore punctuation if enabled
        let processedTranscript = transcript;
        if (this.punctuationToggle.checked) {
            processedTranscript = this.restorePunctuation(transcript);
        }

        // Detect silences if enabled
        if (this.silenceDetection.checked) {
            this.detectSilence();
        }

        // Update current caption
        this.originalText.textContent = processedTranscript;

        // Translate the transcript
        try {
            const translation = await this.translateText(processedTranscript);
            this.translatedText.textContent = translation;

            // Update overlay
            this.updateOverlay(processedTranscript, translation);

            // Add to transcript history
            this.addToTranscriptHistory(processedTranscript, translation);

            // Calculate and update latency
            const endTime = performance.now();
            this.latency = Math.round(endTime - startTime);
            this.updateLatency();

        } catch (error) {
            console.error('Translation error:', error);
            this.translatedText.textContent = 'Translation failed';
        }

        // Reset silence timer
        this.resetSilenceTimer();
    }

    showInterimTranscript(transcript) {
        this.originalText.textContent = transcript + '...';
        this.translatedText.textContent = 'Processing...';
    }

    async translateText(text) {
        // For demo purposes, using a simple translation mapping
        // In production, you would integrate with a real translation API
        const translations = {
            'hello': {
                'es': 'hola',
                'fr': 'bonjour',
                'de': 'hallo',
                'it': 'ciao',
                'pt': 'olá',
                'ru': 'привет',
                'ja': 'こんにちは',
                'ko': '안녕하세요',
                'zh': '你好'
            },
            'how are you': {
                'es': '¿cómo estás?',
                'fr': 'comment allez-vous?',
                'de': 'wie geht es dir?',
                'it': 'come stai?',
                'pt': 'como você está?',
                'ru': 'как дела?',
                'ja': 'お元気ですか？',
                'ko': '어떻게 지내세요?',
                'zh': '你好吗？'
            },
            'thank you': {
                'es': 'gracias',
                'fr': 'merci',
                'de': 'danke',
                'it': 'grazie',
                'pt': 'obrigado',
                'ru': 'спасибо',
                'ja': 'ありがとう',
                'ko': '감사합니다',
                'zh': '谢谢'
            }
        };

        const targetLang = this.targetLanguage.value;
        const lowerText = text.toLowerCase().trim();

        // Check for exact matches first
        if (translations[lowerText] && translations[lowerText][targetLang]) {
            return translations[lowerText][targetLang];
        }

        // Check for partial matches
        for (const [key, value] of Object.entries(translations)) {
            if (lowerText.includes(key) && value[targetLang]) {
                return value[targetLang];
            }
        }

        // Fallback: simple character substitution for demo
        return this.simpleTranslation(text, targetLang);
    }

    simpleTranslation(text, targetLang) {
        // Simple character substitution for demonstration
        const substitutions = {
            'es': { 'a': 'á', 'e': 'é', 'i': 'í', 'o': 'ó', 'u': 'ú' },
            'fr': { 'a': 'à', 'e': 'è', 'i': 'ì', 'o': 'ò', 'u': 'ù' },
            'de': { 'a': 'ä', 'o': 'ö', 'u': 'ü' },
            'it': { 'a': 'à', 'e': 'è', 'i': 'ì', 'o': 'ò', 'u': 'ù' }
        };

        if (substitutions[targetLang]) {
            let translated = text;
            Object.entries(substitutions[targetLang]).forEach(([from, to]) => {
                translated = translated.replace(new RegExp(from, 'gi'), to);
            });
            return translated;
        }

        return `[${targetLang.toUpperCase()}] ${text}`;
    }

    restorePunctuation(text) {
        // Simple punctuation restoration based on speech patterns
        let processed = text.trim();

        // Add period for statements
        if (!processed.endsWith('.') && !processed.endsWith('!') && !processed.endsWith('?')) {
            processed += '.';
        }

        // Capitalize first letter
        processed = processed.charAt(0).toUpperCase() + processed.slice(1);

        // Add question mark for question words
        const questionWords = ['what', 'when', 'where', 'who', 'why', 'how'];
        if (questionWords.some(word => processed.toLowerCase().includes(word))) {
            processed = processed.replace(/\.$/, '?');
        }

        return processed;
    }

    detectSilence() {
        // Reset silence timer
        this.resetSilenceTimer();

        // Set new silence timer
        this.silenceTimer = setTimeout(() => {
            this.originalText.textContent += ' [Silence detected]';
            this.translatedText.textContent += ' [Silencio detectado]';
        }, 2000); // 2 seconds of silence
    }

    resetSilenceTimer() {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    }

    addToTranscriptHistory(original, translation) {
        const timestamp = new Date().toLocaleTimeString();
        const speaker = this.speakerDiarization.checked ? `Speaker ${this.speakerId}` : 'User';

        const transcriptItem = {
            id: Date.now(),
            timestamp,
            speaker,
            original,
            translation,
            timestamp_ms: Date.now()
        };

        this.transcriptHistory.unshift(transcriptItem);
        this.renderTranscriptItem(transcriptItem);

        // Limit history to last 100 items
        if (this.transcriptHistory.length > 100) {
            this.transcriptHistory.pop();
            const oldestItem = this.transcriptList.lastElementChild;
            if (oldestItem) {
                oldestItem.remove();
            }
        }
    }

    renderTranscriptItem(item) {
        const transcriptElement = document.createElement('div');
        transcriptElement.className = 'transcript-item fade-in';
        transcriptElement.innerHTML = `
            <div class="transcript-header">
                <span>${item.speaker} - ${item.timestamp}</span>
            </div>
            <div class="transcript-content">
                <div class="transcript-original">${item.original}</div>
                <div class="transcript-translation">${item.translation}</div>
            </div>
        `;

        this.transcriptList.insertBefore(transcriptElement, this.transcriptList.firstChild);
    }

    updateOverlay(original, translation) {
        const delay = parseInt(this.captionDelay.value);

        setTimeout(() => {
            this.overlayOriginal.textContent = original;
            this.overlayTranslated.textContent = translation;
            this.showOverlay();
        }, delay);
    }

    showOverlay() {
        this.captionOverlay.classList.remove('hidden');
        this.captionOverlay.classList.add('slide-in');
    }

    hideOverlay() {
        this.captionOverlay.classList.add('hidden');
        this.captionOverlay.classList.remove('slide-in');
    }

    updateStatus(text, type = 'ready') {
        this.statusText.textContent = text;
        this.statusDot.className = `status-dot ${type}`;
    }

    updateConnectionInfo() {
        this.connectionTypeEl.textContent = this.connectionType;
        this.updateLatency();
    }

    updateLatency() {
        this.latencyEl.textContent = `Latency: ${this.latency} ms`;
    }

    updateSettings() {
        // Update settings in real-time
        console.log('Settings updated:', {
            punctuation: this.punctuationToggle.checked,
            silenceDetection: this.silenceDetection.checked,
            speakerDiarization: this.speakerDiarization.checked,
            captionDelay: this.captionDelay.value
        });
    }

    clearTranscript() {
        this.transcriptHistory = [];
        this.transcriptList.innerHTML = '';
        this.originalText.textContent = 'Start speaking to see live captions...';
        this.translatedText.textContent = 'Start speaking to see live captions...';
        this.hideOverlay();
    }

    exportTranscript() {
        if (this.transcriptHistory.length === 0) {
            alert('No transcript to export');
            return;
        }

        const exportData = {
            timestamp: new Date().toISOString(),
            sourceLanguage: this.sourceLanguage.value,
            targetLanguage: this.targetLanguage.value,
            transcript: this.transcriptHistory
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcript-${new Date().toISOString().slice(0, 19)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.updateStatus('Transcript exported successfully', 'ready');
        setTimeout(() => this.updateStatus('Ready', 'ready'), 2000);
    }

    // WebRTC and WebSocket fallback methods
    initializeWebRTC() {
        // WebRTC implementation for ultra-low latency
        try {
            // WebRTC peer connection setup would go here
            this.connectionType = 'WebRTC';
            this.updateConnectionInfo();
        } catch (error) {
            console.warn('WebRTC not available, falling back to WebSocket');
            this.initializeWebSocket();
        }
    }

    initializeWebSocket() {
        // WebSocket fallback implementation
        try {
            // WebSocket connection setup would go here
            this.connectionType = 'WebSocket';
            this.updateConnectionInfo();
        } catch (error) {
            console.warn('WebSocket not available, using local processing');
            this.connectionType = 'Local';
            this.updateConnectionInfo();
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new SpeechTranslator();

    // Make app globally accessible for debugging
    window.speechTranslator = app;

    // Initialize connection methods
    app.initializeWebRTC();

    console.log('Real-Time Speech Translator initialized successfully!');
    console.log('Keyboard shortcuts:');
    console.log('- Ctrl/Cmd + Space: Start/Stop listening');
    console.log('- Ctrl/Cmd + E: Export transcript');
});

// Service Worker for offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
