// Real-Time Speech Translator Application
class SpeechTranslator {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.transcriptHistory = [];
        this.currentTranscript = '';
        this.silenceTimer = null;
        this.overlayTimer = null;
        this.speakerId = 1;
        this.connectionType = 'WebSocket';
        this.latency = 0;
        this.sessionId = 'default';
        this.networkRetryCount = 0;
        this.pipWindow = null;
        this.pipVideo = null;
        
        // Add audio context and analyzer for voice detection
        this.audioContext = null;
        this.audioAnalyser = null;
        this.voiceDataArray = null;
        this.voiceProfiles = [];
        this.currentVoiceProfile = null;
        this.lastVoiceTimestamp = 0;
        this.voiceSensitivity = 0.65; // Higher sensitivity (lower threshold)

        this.initializeElements();
        this.initializeSpeechRecognition();
        this.bindEvents();
        this.initializeNetworkListeners();
        this.initializePictureInPicture();
        this.updateStatus('Ready to start', 'ready');

        // Ensure we connect to WebSocket on load so room broadcasts reach overlay
        this.initializeWebSocket();
        
        // Hide the overlay initially after a short delay
        setTimeout(() => this.hideOverlay(), 3000);
    }

    initializeElements() {
        // Control buttons
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.demoBtn = document.getElementById('demoBtn');
        this.testWsBtn = document.getElementById('testWsBtn');
        this.pipBtn = document.getElementById('pipBtn');

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
            
            // Handle network errors specifically
            if (event.error === 'network') {
                this.updateStatus('Network error. Reconnecting...', 'error');
                this.statusDot.classList.add('error');
                
                // Attempt to restart recognition after a short delay
                setTimeout(() => {
                    this.statusDot.classList.remove('error');
                    this.updateStatus('Attempting to reconnect...', 'ready');
                    
                    // Only try to restart if we were previously listening
                    if (this.isListening) {
                        this.stopListening();
                        setTimeout(() => this.startListening(), 1000);
                    }
                }, 3000);
            } else {
                // Handle other errors
                this.updateStatus(`Error: ${event.error}`, 'error');
                this.statusDot.classList.add('error');
                setTimeout(() => this.statusDot.classList.remove('error'), 3000);
            }
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
        this.pipBtn.addEventListener('click', () => this.togglePictureInPicture());

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
            // Check for network connectivity before starting
            if (navigator.onLine === false) {
                this.updateStatus('No internet connection. Please check your network.', 'error');
                this.statusDot.classList.add('error');
                setTimeout(() => this.statusDot.classList.remove('error'), 3000);
                return;
            }
            
            // Initialize audio context for voice analysis if speaker diarization is enabled
            if (this.speakerDiarization.checked) {
                await this.initializeAudioAnalysis();
            }
            
            await this.recognition.start();
            this.updateConnectionInfo();
            this.isListening = true;
        } catch (error) {
            console.error('Failed to start recognition:', error);
            this.updateStatus('Failed to start recognition. Retrying...', 'error');
            
            // If there's an error starting, try again after a short delay
            setTimeout(() => {
                try {
                    this.recognition.start();
                    this.updateStatus('Listening...', 'listening');
                } catch (retryError) {
                    console.error('Retry failed:', retryError);
                    this.updateStatus('Speech recognition unavailable. Please try again later.', 'error');
                }
            }, 2000);
        }
    }

    stopListening() {
        if (this.recognition) {
            try {
                this.recognition.stop();
                this.isListening = false;
                
                // Stop audio analysis if it was running
                if (this.audioContext) {
                    this.stopAudioAnalysis();
                }
            } catch (error) {
                console.error('Error stopping recognition:', error);
                // Force reset the recognition state
                this.isListening = false;
                this.updateStatus('Recognition stopped with errors', 'ready');
                this.startBtn.disabled = false;
                this.stopBtn.disabled = true;
            }
        }
    }
    
    // Initialize audio analysis for speaker detection
    async initializeAudioAnalysis() {
        try {
            // Create audio context and analyzer
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioAnalyser = this.audioContext.createAnalyser();
            this.audioAnalyser.fftSize = 2048;
            
            // Get microphone stream
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.audioContext.createMediaStreamSource(stream);
            source.connect(this.audioAnalyser);
            
            // Set up data array for analysis
            this.voiceDataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
            
            // Start analyzing voice
            this.analyzeVoice();
            
            console.log('Audio analysis initialized for speaker detection');
        } catch (error) {
            console.error('Error initializing audio analysis:', error);
        }
    }
    
    // Stop audio analysis
    stopAudioAnalysis() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
            this.audioAnalyser = null;
            this.voiceDataArray = null;
            console.log('Audio analysis stopped');
        }
    }
    
    // Analyze voice characteristics
    analyzeVoice() {
        if (!this.audioAnalyser || !this.voiceDataArray) return;
        
        // Get frequency data
        this.audioAnalyser.getByteFrequencyData(this.voiceDataArray);
        
        // Calculate voice characteristics (pitch, volume, etc.)
        const voiceProfile = this.calculateVoiceProfile(this.voiceDataArray);
        
        // Check if this is a different speaker
        if (voiceProfile && this.isNewSpeaker(voiceProfile)) {
            // Update speaker ID for a new voice
            this.speakerId++;
            console.log(`New speaker detected! Speaker ID: ${this.speakerId}`);
            
            // Add to voice profiles
            this.voiceProfiles.push({
                id: this.speakerId,
                profile: voiceProfile
            });
            
            // Update current voice profile
            this.currentVoiceProfile = voiceProfile;
            this.lastVoiceTimestamp = Date.now();
        } else if (voiceProfile) {
            // Update current voice profile if not silent
            this.currentVoiceProfile = voiceProfile;
            this.lastVoiceTimestamp = Date.now();
        }
        
        // Continue analyzing if still listening
        if (this.isListening) {
            requestAnimationFrame(() => this.analyzeVoice());
        }
    }
    
    // Calculate voice profile from frequency data
    calculateVoiceProfile(dataArray) {
        // Skip if no sound is detected (silence)
        const sum = dataArray.reduce((a, b) => a + b, 0);
        if (sum < 400) return null; // Lower threshold for more sensitivity
        
        // Calculate average frequency (simple pitch estimation)
        let totalFrequency = 0;
        let count = 0;
        
        // Focus on vocal frequency range (approximately 80Hz to 1200Hz for human voices)
        // We need to convert FFT bin index to frequency
        const sampleRate = this.audioContext.sampleRate;
        const binCount = this.audioAnalyser.frequencyBinCount;
        const frequencyResolution = sampleRate / (2 * binCount);
        
        for (let i = 0; i < dataArray.length; i++) {
            const frequency = i * frequencyResolution;
            if (frequency >= 80 && frequency <= 1200 && dataArray[i] > 30) { // Lower threshold for more sensitivity
                totalFrequency += frequency * dataArray[i];
                count += dataArray[i];
            }
        }
        
        // Calculate weighted average frequency
        const avgFrequency = count > 0 ? totalFrequency / count : 0;
        
        // Calculate energy distribution (formants)
        const lowEnergy = this.calculateBandEnergy(dataArray, 80, 250, frequencyResolution);
        const midEnergy = this.calculateBandEnergy(dataArray, 250, 600, frequencyResolution);
        const highEnergy = this.calculateBandEnergy(dataArray, 600, 1200, frequencyResolution);
        
        // Calculate spectral centroid (brightness of sound)
        const spectralCentroid = this.calculateSpectralCentroid(dataArray, frequencyResolution);
        
        // Calculate spectral flux (rate of change)
        const spectralFlux = this.calculateSpectralFlux(dataArray, this.previousDataArray || dataArray);
        
        // Store current data for next comparison
        this.previousDataArray = new Uint8Array(dataArray);
        
        return {
            avgFrequency,
            lowEnergy,
            midEnergy,
            highEnergy,
            spectralCentroid,
            spectralFlux,
            timestamp: Date.now()
        };
    }
    
    // Calculate energy in a specific frequency band
    calculateBandEnergy(dataArray, minFreq, maxFreq, resolution) {
        let energy = 0;
        const minBin = Math.floor(minFreq / resolution);
        const maxBin = Math.ceil(maxFreq / resolution);
        
        for (let i = minBin; i < maxBin && i < dataArray.length; i++) {
            energy += dataArray[i] * dataArray[i]; // Square for energy
        }
        
        return energy;
    }
    
    // Calculate spectral centroid (brightness of sound)
    calculateSpectralCentroid(dataArray, resolution) {
        let numerator = 0;
        let denominator = 0;
        
        for (let i = 0; i < dataArray.length; i++) {
            const frequency = i * resolution;
            numerator += frequency * dataArray[i];
            denominator += dataArray[i];
        }
        
        return denominator > 0 ? numerator / denominator : 0;
    }
    
    // Calculate spectral flux (rate of change)
    calculateSpectralFlux(currentArray, previousArray) {
        let flux = 0;
        
        for (let i = 0; i < currentArray.length; i++) {
            const diff = currentArray[i] - previousArray[i];
            flux += diff * diff;
        }
        
        return Math.sqrt(flux);
    }
    
    // Check if the voice profile represents a new speaker
    isNewSpeaker(currentProfile) {
        if (!this.currentVoiceProfile) return true;
        if (this.voiceProfiles.length === 0) return true;
        
        // If it's been a while since the last voice, consider it a new speaker
        const timeSinceLastVoice = Date.now() - this.lastVoiceTimestamp;
        if (timeSinceLastVoice > 5000) { // 5 seconds of silence
            return true;
        }
        
        // Calculate similarity with current voice profile
        const similarity = this.calculateProfileSimilarity(currentProfile, this.currentVoiceProfile);
        
        // If similarity is below threshold, consider it a new speaker
        // Using voiceSensitivity as threshold (lower value = more sensitive)
        return similarity < this.voiceSensitivity;
    }
    
    // Calculate similarity between two voice profiles
    calculateProfileSimilarity(profile1, profile2) {
        // Enhanced similarity calculation with more features
        const freqDiff = Math.abs(profile1.avgFrequency - profile2.avgFrequency) / 500; // Normalize
        const lowEnergyDiff = Math.abs(Math.log(profile1.lowEnergy + 1) - Math.log(profile2.lowEnergy + 1)) / 10;
        const midEnergyDiff = Math.abs(Math.log(profile1.midEnergy + 1) - Math.log(profile2.midEnergy + 1)) / 10;
        const highEnergyDiff = Math.abs(Math.log(profile1.highEnergy + 1) - Math.log(profile2.highEnergy + 1)) / 10;
        const centroidDiff = Math.abs(profile1.spectralCentroid - profile2.spectralCentroid) / 1000;
        const fluxDiff = Math.abs(profile1.spectralFlux - profile2.spectralFlux) / 100;
        
        // Weight the differences (pitch and formants are most important for voice identification)
        const totalDiff = (freqDiff * 0.3) + 
                         (lowEnergyDiff * 0.2) + 
                         (midEnergyDiff * 0.2) + 
                         (highEnergyDiff * 0.1) + 
                         (centroidDiff * 0.1) + 
                         (fluxDiff * 0.1);
        
        // Convert difference to similarity (1 = identical, 0 = completely different)
        return Math.max(0, 1 - totalDiff);
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

            // Emit caption overlay update to session so Electron overlay shows it
            if (this.socket && this.socket.connected && this.sessionId) {
                this.socket.emit('caption-overlay', {
                    sessionId: this.sessionId,
                    originalText: processedTranscript,
                    translatedText: translation,
                    position: { x: 0.5, y: 0.9 }
                });
            }

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
            
            // Update PiP content if active
            if (this.pipVideo && document.pictureInPictureElement === this.pipVideo) {
                this.updatePipContent(original, translation);
            }
        }, delay);
    }

    showOverlay() {
        // Ensure the overlay is visible by removing the hidden class
        this.captionOverlay.classList.remove('hidden');
        this.captionOverlay.classList.add('slide-in');
        
        // Make sure the overlay is displayed for a minimum time
        clearTimeout(this.overlayTimer);
        this.overlayTimer = setTimeout(() => {
            // Auto-hide after 5 seconds if no new captions
            this.hideOverlay();
        }, 5000);
    }

    hideOverlay() {
        // Don't completely hide the overlay, just make it less visible
        this.captionOverlay.classList.add('hidden');
        this.captionOverlay.classList.remove('slide-in');
        
        // Reset overlay content
        this.overlayOriginal.textContent = 'Waiting for speech...';
        this.overlayTranslated.textContent = 'Waiting for translation...';
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
        
        // Handle speaker diarization toggle
        if (this.speakerDiarization.checked) {
            // Initialize audio analysis if we're currently listening
            if (this.isListening && !this.audioContext) {
                this.initializeAudioAnalysis();
            }
            // Reset speaker profiles when toggling on
            this.voiceProfiles = [];
            this.speakerId = 1;
        } else {
            // Stop audio analysis if it's running
            if (this.audioContext) {
                this.stopAudioAnalysis();
            }
            // Reset speaker ID
            this.speakerId = 1;
        }
    }

    // Reset speaker detection (can be called when you want to start fresh)
    resetSpeakerDetection() {
        this.voiceProfiles = [];
        this.currentVoiceProfile = null;
        this.speakerId = 1;
        console.log('Speaker detection reset');
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

    initializeNetworkListeners() {
        // Add event listeners for online and offline events
        window.addEventListener('online', () => {
            console.log('Network connection restored');
            this.updateStatus('Network connection restored', 'ready');
            this.networkRetryCount = 0;
            
            // Reconnect WebSocket if needed
            if (this.socket && !this.socket.connected) {
                this.initializeWebSocket();
            }
            
            // Restart speech recognition if it was active
            if (this.isListening) {
                this.startListening();
            }
        });
        
        window.addEventListener('offline', () => {
            console.log('Network connection lost');
            this.updateStatus('Network connection lost. Waiting for reconnection...', 'error');
            
            // If currently listening, stop to prevent errors
            if (this.isListening) {
                this.stopListening();
            }
        });
    }
    
    initializePictureInPicture() {
        // Create a hidden video element for Picture-in-Picture
        this.pipVideo = document.createElement('video');
        this.pipVideo.width = 400;
        this.pipVideo.height = 200;
        this.pipVideo.muted = true;
        this.pipVideo.autoplay = true;
        this.pipVideo.style.display = 'none';
        document.body.appendChild(this.pipVideo);
        
        // Create a canvas for rendering captions
        this.pipCanvas = document.createElement('canvas');
        this.pipCanvas.width = 400;
        this.pipCanvas.height = 200;
        this.pipCanvas.style.display = 'none';
        document.body.appendChild(this.pipCanvas);
        
        // Draw initial content to the canvas
        const ctx = this.pipCanvas.getContext('2d');
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.pipCanvas.width, this.pipCanvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Ready for Picture-in-Picture', this.pipCanvas.width / 2, this.pipCanvas.height / 2);
        
        // Set up the video stream from the canvas
        const canvasStream = this.pipCanvas.captureStream();
        this.pipVideo.srcObject = canvasStream;
        
        // Ensure video starts playing to load metadata
        this.pipVideo.play().catch(e => console.log('Initial play prevented:', e));
        
        // Handle PiP mode changes
        this.pipVideo.addEventListener('enterpictureinpicture', (event) => {
            this.pipWindow = event.pictureInPictureWindow;
            this.updateStatus('Picture-in-Picture mode active', 'ready');
            this.pipBtn.textContent = '🔄 Exit PiP';
            
            // Update PiP content with current captions
            this.updatePipContent(
                this.overlayOriginal.textContent, 
                this.overlayTranslated.textContent
            );
        });
        
        this.pipVideo.addEventListener('leavepictureinpicture', () => {
            this.pipWindow = null;
            this.updateStatus('Picture-in-Picture mode exited', 'ready');
            this.pipBtn.textContent = '📺 Picture-in-Picture';
        });
    }
    
    togglePictureInPicture() {
        if (document.pictureInPictureElement) {
            // Exit PiP mode
            document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled) {
            // Enter PiP mode
            // Make sure the video has metadata loaded before requesting PiP
            if (this.pipVideo.readyState === 0) {
                // Draw initial content to the canvas to ensure video has data
                const ctx = this.pipCanvas.getContext('2d');
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(0, 0, this.pipCanvas.width, this.pipCanvas.height);
                ctx.fillStyle = 'white';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Initializing Picture-in-Picture...', this.pipCanvas.width / 2, this.pipCanvas.height / 2);
                
                // Wait for metadata to load before requesting PiP
                this.pipVideo.addEventListener('loadedmetadata', () => {
                    this.pipVideo.requestPictureInPicture()
                        .catch(error => {
                            console.error('PiP error:', error);
                            this.updateStatus('Picture-in-Picture failed: ' + error.message, 'error');
                        });
                }, { once: true });
                
                // Trigger a play to help load metadata
                this.pipVideo.play().catch(e => console.error('Play error:', e));
            } else {
                // Metadata already loaded, request PiP directly
                this.pipVideo.requestPictureInPicture()
                    .catch(error => {
                        console.error('PiP error:', error);
                        this.updateStatus('Picture-in-Picture failed: ' + error.message, 'error');
                    });
            }
        } else {
            this.updateStatus('Picture-in-Picture not supported in this browser', 'error');
        }
    }
    
    updatePipContent(originalText, translatedText) {
        if (!this.pipCanvas || !this.pipWindow) return;
        
        const ctx = this.pipCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.pipCanvas.width, this.pipCanvas.height);
        
        // Set background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.pipCanvas.width, this.pipCanvas.height);
        
        // Draw text
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        
        // Original text at top
        ctx.fillText(originalText || 'Waiting for speech...', 
            this.pipCanvas.width / 2, 50, this.pipCanvas.width - 20);
        
        // Translated text at bottom
        ctx.fillStyle = '#4CAF50';
        ctx.fillText(translatedText || 'Waiting for translation...', 
            this.pipCanvas.width / 2, 120, this.pipCanvas.width - 20);
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
                    this.networkRetryCount = 0;

                    // Join session so other clients (overlay) receive room broadcasts
                    this.socket.emit('join-session', {
                        sessionId: this.sessionId,
                        sourceLanguage: this.sourceLanguage.value,
                        targetLanguage: this.targetLanguage.value
                    });
                });

                this.socket.on('disconnect', (reason) => {
                    console.log('WebSocket disconnected:', reason);
                    this.connectionType = 'WebSocket (Disconnected)';
                    this.updateConnectionInfo();
                    this.updateStatus('WebSocket disconnected', 'error');
                    
                    // Attempt to reconnect if not intentionally closed
                    if (reason !== 'io client disconnect') {
                        setTimeout(() => this.initializeWebSocket(), 2000);
                    }
                });

                this.socket.on('error', (error) => {
                    console.error('WebSocket error:', error);
                    this.updateStatus('WebSocket error', 'error');
                });

                this.socket.on('connect_error', (error) => {
                    console.error('WebSocket connection error:', error);
                    
                    // Increment retry count and attempt to reconnect if under threshold
                    this.networkRetryCount++;
                    if (this.networkRetryCount < 5) {
                        setTimeout(() => this.initializeWebSocket(), 2000 * this.networkRetryCount);
                    } else {
                        this.updateStatus('Cannot connect to server. Please check your network.', 'error');
                    }
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
            setTimeout(() => this.initializeWebSocket(), 3000);
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
