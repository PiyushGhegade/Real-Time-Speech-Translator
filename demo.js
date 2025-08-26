// Demo script for Real-Time Speech Translator
// This script demonstrates the application's capabilities

class SpeechTranslatorDemo {
    constructor() {
        this.demoData = [
            {
                original: "Hello, how are you today?",
                translation: "Hola, ¿cómo estás hoy?",
                language: "en",
                targetLanguage: "es"
            },
            {
                original: "The weather is beautiful today.",
                translation: "Le temps est magnifique aujourd'hui.",
                language: "en",
                targetLanguage: "fr"
            },
            {
                original: "Can you help me with this project?",
                translation: "Kannst du mir bei diesem Projekt helfen?",
                language: "en",
                targetLanguage: "de"
            },
            {
                original: "Thank you very much for your assistance.",
                translation: "Grazie mille per il tuo aiuto.",
                language: "en",
                targetLanguage: "it"
            }
        ];

        this.currentIndex = 0;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        console.log('🚀 Starting Speech Translator Demo...');

        // Simulate real-time speech recognition and translation
        this.runDemo();
    }

    stop() {
        this.isRunning = false;
        console.log('⏹️ Demo stopped');
    }

    runDemo() {
        if (!this.isRunning) return;

        const demoItem = this.demoData[this.currentIndex];

        // Simulate speech recognition delay
        setTimeout(() => {
            this.simulateSpeechRecognition(demoItem.original);

            // Simulate translation delay
            setTimeout(() => {
                this.simulateTranslation(demoItem.translation);

                // Move to next demo item
                this.currentIndex = (this.currentIndex + 1) % this.demoData.length;

                // Continue demo if still running
                if (this.isRunning) {
                    setTimeout(() => this.runDemo(), 3000); // 3 second delay between items
                }
            }, 800); // Translation delay
        }, 500); // Speech recognition delay
    }

    simulateSpeechRecognition(text) {
        console.log('🎤 Speech Recognized:', text);

        // Update UI elements if they exist
        const originalText = document.getElementById('originalText');
        if (originalText) {
            originalText.textContent = text;
            originalText.style.color = '#4CAF50';
        }

        // Simulate interim results
        this.simulateInterimResults(text);
    }

    simulateTranslation(translation) {
        console.log('🌐 Translation:', translation);

        // Update UI elements if they exist
        const translatedText = document.getElementById('translatedText');
        if (translatedText) {
            translatedText.textContent = translation;
            translatedText.style.color = '#667eea';
        }

        // Add to transcript history
        this.addToTranscriptHistory(translation);

        // Update overlay
        this.updateOverlay(translation);
    }

    simulateInterimResults(text) {
        // Simulate interim speech recognition results
        let currentText = '';
        const words = text.split(' ');

        const interval = setInterval(() => {
            if (currentText.length < text.length) {
                currentText = text.substring(0, currentText.length + 1);

                const originalText = document.getElementById('originalText');
                if (originalText) {
                    originalText.textContent = currentText + '...';
                    originalText.style.color = '#FF9800';
                }
            } else {
                clearInterval(interval);
            }
        }, 50);
    }

    addToTranscriptHistory(translation) {
        const transcriptList = document.getElementById('transcriptList');
        if (!transcriptList) return;

        const timestamp = new Date().toLocaleTimeString();
        const transcriptItem = document.createElement('div');
        transcriptItem.className = 'transcript-item fade-in';
        transcriptItem.innerHTML = `
            <div class="transcript-header">
                <span>Demo Speaker - ${timestamp}</span>
            </div>
            <div class="transcript-content">
                <div class="transcript-original">[Demo speech input]</div>
                <div class="transcript-translation">${translation}</div>
            </div>
        `;

        transcriptList.insertBefore(transcriptItem, transcriptList.firstChild);

        // Limit history to last 10 items for demo
        if (transcriptList.children.length > 10) {
            transcriptList.removeChild(transcriptList.lastElementChild);
        }
    }

    updateOverlay(translation) {
        const overlay = document.getElementById('captionOverlay');
        const overlayTranslated = document.getElementById('overlayTranslated');

        if (overlay && overlayTranslated) {
            overlayTranslated.textContent = translation;
            overlay.classList.remove('hidden');
            overlay.classList.add('slide-in');

            // Hide overlay after 3 seconds
            setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.classList.remove('slide-in');
            }, 3000);
        }
    }

    // Demo controls
    showControls() {
        const controls = document.createElement('div');
        controls.className = 'demo-controls';
        controls.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 15px;
            border-radius: 10px;
            z-index: 10000;
            font-family: monospace;
        `;

        controls.innerHTML = `
            <h4>🎬 Demo Controls</h4>
            <button id="demoStart" style="margin: 5px; padding: 8px 12px; border-radius: 5px; border: none; background: #4CAF50; color: white; cursor: pointer;">Start Demo</button>
            <button id="demoStop" style="margin: 5px; padding: 8px 12px; border-radius: 5px; border: none; background: #f44336; color: white; cursor: pointer;">Stop Demo</button>
            <button id="demoReset" style="margin: 5px; padding: 8px 12px; border-radius: 5px; border: none; background: #2196F3; color: white; cursor: pointer;">Reset</button>
            <div style="margin-top: 10px; font-size: 12px;">
                <div>Status: <span id="demoStatus">Stopped</span></div>
                <div>Items: ${this.demoData.length}</div>
            </div>
        `;

        document.body.appendChild(controls);

        // Bind events
        document.getElementById('demoStart').addEventListener('click', () => this.start());
        document.getElementById('demoStop').addEventListener('click', () => this.stop());
        document.getElementById('demoReset').addEventListener('click', () => this.reset());

        // Update status
        this.updateDemoStatus();
    }

    updateDemoStatus() {
        const status = document.getElementById('demoStatus');
        if (status) {
            status.textContent = this.isRunning ? 'Running' : 'Stopped';
            status.style.color = this.isRunning ? '#4CAF50' : '#f44336';
        }
    }

    reset() {
        this.stop();
        this.currentIndex = 0;

        // Clear transcript
        const transcriptList = document.getElementById('transcriptList');
        if (transcriptList) {
            transcriptList.innerHTML = '';
        }

        // Reset captions
        const originalText = document.getElementById('originalText');
        const translatedText = document.getElementById('translatedText');
        if (originalText) originalText.textContent = 'Start speaking to see live captions...';
        if (translatedText) translatedText.textContent = 'Start speaking to see live captions...';

        // Hide overlay
        const overlay = document.getElementById('captionOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }

        console.log('🔄 Demo reset');
        this.updateDemoStatus();
    }
}

// Initialize demo when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for the main app to initialize
    setTimeout(() => {
        const demo = new SpeechTranslatorDemo();
        demo.showControls();

        // Make demo globally accessible
        window.speechTranslatorDemo = demo;

        console.log('🎬 Speech Translator Demo initialized!');
        console.log('Use the demo controls to see the application in action.');
    }, 2000);
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpeechTranslatorDemo;
}
