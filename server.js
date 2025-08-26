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

// Import the translation service
const TranslationService = require('./translationService');

// Initialize translation service
const translationService = new TranslationService();

// Translation function using real translation APIs
async function translateText(text, sourceLanguage, targetLanguage) {
    try {
        return await translationService.translateText(text, sourceLanguage, targetLanguage);
    } catch (error) {
        console.error('Translation error:', error);
        // Return fallback if all services fail
        return `[${targetLanguage.toUpperCase()}] ${text}`;
    }
}

// API endpoints
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        translationServices: translationService.getServiceStatus()
    });
});

app.get('/api/translation/status', (req, res) => {
    res.json({
        services: translationService.getServiceStatus(),
        supportedLanguages: translationService.getSupportedLanguages(),
        cacheStats: {
            keys: translationService.cache.keys().length,
            ttl: translationService.cache.getTtl()
        }
    });
});

app.post('/api/translation/clear-cache', (req, res) => {
    try {
        translationService.clearCache();
        res.json({ message: 'Translation cache cleared successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear cache' });
    }
});

app.post('/api/translation/test', async (req, res) => {
    const { text, sourceLanguage, targetLanguage } = req.body;

    if (!text || !targetLanguage) {
        return res.status(400).json({ error: 'Text and target language are required' });
    }

    try {
        const translation = await translationService.translateText(text, sourceLanguage, targetLanguage);
        res.json({
            originalText: text,
            translatedText: translation,
            sourceLanguage: sourceLanguage || 'auto',
            targetLanguage: targetLanguage
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/translation/services', (req, res) => {
    res.json({
        services: translationService.getDetailedServiceStatus(),
        requestStats: translationService.getRequestStats(),
        lastHealthCheck: new Date(translationService.lastHealthCheck).toISOString()
    });
});

app.post('/api/translation/test-service/:service', async (req, res) => {
    const { service } = req.params;

    if (!['azure', 'deepl', 'microsoft'].includes(service)) {
        return res.status(400).json({ error: 'Invalid service. Use: azure, deepl, or microsoft' });
    }

    try {
        const result = await translationService.testService(service);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/translation/languages', (req, res) => {
    res.json(translationService.getSupportedLanguages());
});

app.get('/api/sessions', (req, res) => {
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
