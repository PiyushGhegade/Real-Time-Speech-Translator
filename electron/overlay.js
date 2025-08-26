(() => {
    const originalEl = document.getElementById('original');
    const translatedEl = document.getElementById('translated');

    let scale = 1.0;
    function applyScale() {
        originalEl.style.transform = `scale(${scale})`;
        translatedEl.style.transform = `scale(${scale})`;
    }

    window.overlay.onScale((factor) => {
        scale = Math.max(0.5, Math.min(3, scale * factor));
        applyScale();
    });

    function getConfig() {
        const cfg = {
            serverUrl: localStorage.getItem('overlayServerUrl') || 'http://localhost:3001',
            sessionId: localStorage.getItem('overlaySessionId') || ''
        };
        if (!cfg.sessionId) {
            cfg.sessionId = prompt('Enter session ID to join (e.g., default):', 'default') || 'default';
            localStorage.setItem('overlaySessionId', cfg.sessionId);
        }
        if (!cfg.serverUrl) {
            cfg.serverUrl = prompt('Enter server URL (e.g., http://localhost:3001):', 'http://localhost:3001') || 'http://localhost:3001';
            localStorage.setItem('overlayServerUrl', cfg.serverUrl);
        }
        return cfg;
    }

    // Auto-connect to Socket.IO server
    function connectSocket() {
        const { serverUrl, sessionId } = getConfig();

        const ensureIo = () => new Promise((resolve) => {
            if (window.io) return resolve();
            const s = document.createElement('script');
            s.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
            s.onload = () => resolve();
            document.head.appendChild(s);
        });

        ensureIo().then(() => {
            const socket = window.io(serverUrl, { transports: ['websocket'], timeout: 5000 });

            socket.on('connect', () => {
                setStatus('Connected');
                // Join the specified session so we receive room broadcasts
                socket.emit('join-session', {
                    sessionId,
                    sourceLanguage: 'auto',
                    targetLanguage: 'en'
                });
            });

            socket.on('session-joined', () => {
                setStatus('Joined session: ' + sessionId);
            });

            // Show any of the translation events
            socket.on('translation-ready', handleTranslation);
            socket.on('translation-sent', (data) => handleTranslation({
                originalText: data.originalText,
                translatedText: data.translatedText
            }));
            // Show explicit overlay updates
            socket.on('caption-overlay-update', (data) => handleTranslation({
                originalText: data.originalText,
                translatedText: data.translatedText
            }));

            socket.on('disconnect', () => setStatus('Disconnected'));
            socket.on('connect_error', () => setStatus('Connect error'));
        });
    }

    function setStatus(text) {
        originalEl.textContent = text;
        translatedEl.textContent = '';
    }

    function handleTranslation(data) {
        if (!data) return;
        originalEl.textContent = data.originalText || '';
        translatedEl.textContent = data.translatedText || '';
    }

    connectSocket();
})();
