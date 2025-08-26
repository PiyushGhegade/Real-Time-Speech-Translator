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
        this.demoBtn = document.getElementById('demoBtn');
        this.testWsBtn = document.getElementById('testWsBtn');

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
        this.demoBtn.addEventListener('click', () => this.runDemo());
        this.testWsBtn.addEventListener('click', () => this.testWebSocket());
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
        // Use the server's translation service instead of hardcoded translations
        try {
            const targetLang = this.targetLanguage.value;
            const sourceLang = this.sourceLanguage.value;

            // Send translation request to server via WebSocket
            if (this.socket && this.socket.connected) {
                return new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Translation timeout'));
                    }, 10000); // 10 second timeout

                    this.socket.emit('translate-request', {
                        text: text,
                        sourceLanguage: sourceLang,
                        targetLanguage: targetLang,
                        sessionId: this.sessionId
                    });

                    // Listen for translation response
                    const handleTranslation = (data) => {
                        clearTimeout(timeout);
                        this.socket.off('translation-sent', handleTranslation);
                        resolve(data.translatedText);
                    };

                    this.socket.on('translation-sent', handleTranslation);
                });
            } else {
                // Fallback if WebSocket is not available
                throw new Error('WebSocket connection not available');
            }
        } catch (error) {
            console.error('Translation error:', error);
            // Return fallback message
            return `[${this.targetLanguage.value.toUpperCase()}] ${text}`;
        }
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

    // Test WebSocket connection
    testWebSocket() {
        this.updateStatus('Testing WebSocket connection...', 'listening');

        if (this.socket && this.socket.connected) {
            // Send a test ping
            this.socket.emit('ping', { timestamp: Date.now() });
            this.updateStatus('WebSocket connected, sent ping', 'ready');

            // Test translation request
            this.socket.emit('translate-request', {
                text: 'hello',
                sourceLanguage: 'en',
                targetLanguage: 'es',
                sessionId: 'test-session'
            });

            setTimeout(() => {
                this.updateStatus('WebSocket test completed', 'ready');
            }, 2000);
        } else if (typeof io === 'undefined') {
            this.updateStatus('Socket.IO not loaded, check CDN connection', 'error');
            console.error('Socket.IO library not available. Please check your internet connection.');
        } else {
            this.updateStatus('WebSocket not connected, attempting connection...', 'error');
            this.initializeWebSocket();
        }
    }

    // Demo mode for testing translations without microphone
    runDemo() {
        const demoTexts = [
            'hello',
            'how are you',
            'i am fine thank you',
            'good morning',
            'goodbye',
            'mother and father have one son and one daughter',
            'please help me',
            'excuse me sorry',
            'yes no water food',
            'one two three'
        ];

        let currentIndex = 0;
        this.updateStatus('Demo mode running...', 'listening');

        const demoInterval = setInterval(() => {
            if (currentIndex >= demoTexts.length) {
                clearInterval(demoInterval);
                this.updateStatus('Demo completed', 'ready');
                return;
            }

            const text = demoTexts[currentIndex];
            this.processFinalTranscript(text);
            currentIndex++;
        }, 2000); // Show each text for 2 seconds
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
        console.log("Initializing WebSocket...");
        console.log("Socket.IO available:", typeof io !== "undefined");

        try {
            // Check if Socket.IO is available globally
            if (typeof io !== 'undefined') {
                this.socket = io('http://localhost:3001', {
                    transports: ['websocket', 'polling'],
                    timeout: 20000,
                    forceNew: true
                });

                this.socket.on('connect', () => {
                    console.log('WebSocket connected successfully');
                    this.connectionType = 'WebSocket';
                    this.updateConnectionInfo();
                    this.updateStatus('WebSocket connected', 'ready');
                });

                this.socket.on('disconnect', () => {
                    console.log('WebSocket disconnected');
                    this.connectionType = 'WebSocket (Disconnected)';
                    this.updateConnectionInfo();
                    this.updateStatus('WebSocket disconnected', 'error');
                });

                this.socket.on('error', (error) => {
                    console.error('WebSocket error:', error);
                    this.updateStatus('WebSocket error', 'error');
                });

                // Handle server events
                this.socket.on('translation-ready', (data) => {
                    console.log('Translation received:', data);
                });

                this.socket.on('speech-processed', (data) => {
                    console.log('Speech processed:', data);
                });

                // Handle pong response
                this.socket.on('pong', (data) => {
                    console.log('Pong received:', data);
                    this.latency = Date.now() - data.timestamp;
                    this.updateLatency();
                });

            } else {
                console.warn('Socket.IO client not available globally');
                this.connectionType = 'Local';
                this.updateConnectionInfo();
                this.updateStatus('Socket.IO not available, using local processing', 'error');
            }
        } catch (error) {
            console.warn('WebSocket not available, using local processing:', error);
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
