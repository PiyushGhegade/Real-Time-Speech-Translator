const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Store connected clients and their sessions
const clients = new Map();
const sessions = new Map();

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Store client information
    clients.set(socket.id, {
        id: socket.id,
        connectedAt: new Date(),
        language: 'en',
        targetLanguage: 'es'
    });

    // Handle client joining a session
    socket.on('join-session', (sessionData) => {
        const { sessionId, sourceLanguage, targetLanguage } = sessionData;

        socket.join(sessionId);
        clients.get(socket.id).sessionId = sessionId;
        clients.get(socket.id).sourceLanguage = sourceLanguage;
        clients.get(socket.id).targetLanguage = targetLanguage;

        if (!sessions.has(sessionId)) {
            sessions.set(sessionId, {
                id: sessionId,
                participants: new Set(),
                transcript: [],
                startTime: new Date()
            });
        }

        sessions.get(sessionId).participants.add(socket.id);

        socket.emit('session-joined', {
            sessionId,
            participants: sessions.get(sessionId).participants.size
        });

        console.log(`Client ${socket.id} joined session ${sessionId}`);
    });

    // Handle speech data from client
    socket.on('speech-data', async (data) => {
        const { sessionId, audioData, timestamp, language } = data;
        const client = clients.get(socket.id);

        if (!client || !sessionId) return;

        try {
            // Process speech data (in production, this would involve ASR service)
            const processedData = await processSpeechData(audioData, language);

            // Broadcast to all clients in the session
            socket.to(sessionId).emit('speech-processed', {
                sessionId,
                speakerId: socket.id,
                transcript: processedData.transcript,
                confidence: processedData.confidence,
                timestamp: Date.now()
            });

            // Store in session transcript
            if (sessions.has(sessionId)) {
                sessions.get(sessionId).transcript.push({
                    speakerId: socket.id,
                    transcript: processedData.transcript,
                    timestamp: Date.now(),
                    confidence: processedData.confidence
                });
            }

        } catch (error) {
            console.error('Error processing speech data:', error);
            socket.emit('error', { message: 'Failed to process speech data' });
        }
    });

    // Handle translation requests
    socket.on('translate-request', async (data) => {
        const { text, sourceLanguage, targetLanguage, sessionId } = data;

        try {
            const translation = await translateText(text, sourceLanguage, targetLanguage);

            // Broadcast translation to session
            socket.to(sessionId).emit('translation-ready', {
                sessionId,
                originalText: text,
                translatedText: translation,
                sourceLanguage,
                targetLanguage,
                timestamp: Date.now()
            });

            // Send confirmation to sender
            socket.emit('translation-sent', {
                originalText: text,
                translatedText: translation,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('Translation error:', error);
            socket.emit('error', { message: 'Translation failed' });
        }
    });

    // Handle caption overlay requests
    socket.on('caption-overlay', (data) => {
        const { sessionId, originalText, translatedText, position } = data;

        // Broadcast caption overlay to all clients in session
        socket.to(sessionId).emit('caption-overlay-update', {
            sessionId,
            originalText,
            translatedText,
            position,
            timestamp: Date.now()
        });
    });

    // Handle speaker diarization
    socket.on('speaker-identification', (data) => {
        const { sessionId, audioSample, speakerId } = data;

        // In production, this would use a proper speaker diarization service
        // For now, we'll just broadcast the speaker identification
        socket.to(sessionId).emit('speaker-identified', {
            sessionId,
            speakerId,
            timestamp: Date.now()
        });
    });

    // Handle silence detection
    socket.on('silence-detected', (data) => {
        const { sessionId, duration, timestamp } = data;

        // Broadcast silence detection to session
        socket.to(sessionId).emit('silence-update', {
            sessionId,
            duration,
            timestamp
        });
    });

    // Handle client disconnection
    socket.on('disconnect', () => {
        const client = clients.get(socket.id);
        if (client && client.sessionId) {
            const session = sessions.get(client.sessionId);
            if (session) {
                session.participants.delete(socket.id);

                // If session is empty, clean it up
                if (session.participants.size === 0) {
                    sessions.delete(client.sessionId);
                }
            }
        }

        clients.delete(socket.id);
        console.log(`Client disconnected: ${socket.id}`);
    });

    // Handle ping/pong for latency measurement
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
    });
});

// Speech processing function (placeholder for production ASR service)
async function processSpeechData(audioData, language) {
    // In production, this would send audio to a speech recognition service
    // For demo purposes, we'll simulate processing
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                transcript: `[Processed speech in ${language}]`,
                confidence: 0.95,
                language: language
            });
        }, 50); // Simulate 50ms processing time
    });
}

// Translation function (placeholder for production translation service)
async function translateText(text, sourceLanguage, targetLanguage) {
    // In production, this would use a real translation API
    // For demo purposes, we'll use simple mappings
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
        }
    };

    const lowerText = text.toLowerCase().trim();

    if (translations[lowerText] && translations[lowerText][targetLanguage]) {
        return translations[lowerText][targetLanguage];
    }

    // Fallback translation
    return `[${targetLanguage.toUpperCase()}] ${text}`;
}

// API endpoints
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        clients: clients.size,
        sessions: sessions.size
    });
});

app.get('/api/sessions', (req, res) => {
    const sessionList = Array.from(sessions.values()).map(session => ({
        id: session.id,
        participants: session.participants.size,
        startTime: session.startTime,
        transcriptLength: session.transcript.length
    }));

    res.json(sessionList);
});

app.get('/api/sessions/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
        id: session.id,
        participants: Array.from(session.participants),
        startTime: session.startTime,
        transcript: session.transcript
    });
});

app.post('/api/export-transcript/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const exportData = {
        sessionId: session.id,
        startTime: session.startTime,
        endTime: new Date(),
        participants: Array.from(session.participants),
        transcript: session.transcript
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="transcript-${session.id}.json"`);
    res.json(exportData);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Real-Time Speech Translator Server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready for real-time communication`);
    console.log(`🌐 HTTP server serving static files and API endpoints`);
    console.log(`📊 Health check available at: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
