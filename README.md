# 🎤 Real-Time Speech Translator

A powerful, real-time speech translation application designed for online meetings (Zoom, Google Meet, Microsoft Teams) with ultra-low latency captions, punctuation restoration, and speaker diarization.

## ✨ Features

### 🚀 Core Functionality

- **Real-time Speech Recognition** - Instant transcription using Web Speech API
- **Live Translation** - Support for 10+ languages with instant translation
- **Low-Latency Captions** - WebRTC + WebSocket fallback for minimal delay
- **Punctuation Restoration** - Intelligent punctuation based on speech patterns
- **Silence Detection** - Automatic detection and marking of speech pauses
- **Speaker Diarization** - Identify and track different speakers

### 🎯 Meeting Integration

- **Caption Overlay** - Floating captions for screen sharing
- **Exportable Transcripts** - JSON format with timestamps and speaker info
- **Session Management** - Multi-participant meeting support
- **Offline Support** - PWA with service worker caching

### 🎨 User Experience

- **Self-Explanatory UI** - No additional instructions needed
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Keyboard Shortcuts** - Ctrl/Cmd + Space to start/stop, Ctrl/Cmd + E to export
- **Real-time Status** - Live connection type and latency monitoring

## 🛠️ Technology Stack

### Frontend

- **HTML5** - Semantic markup with accessibility features
- **CSS3** - Modern styling with gradients, animations, and responsive design
- **JavaScript ES6+** - Class-based architecture with async/await
- **Web Speech API** - Native browser speech recognition
- **Service Workers** - Offline support and PWA capabilities

### Backend

- **Node.js** - Server-side runtime
- **Express.js** - Web framework
- **Socket.IO** - Real-time WebSocket communication
- **CORS** - Cross-origin resource sharing

### Communication

- **WebRTC** - Ultra-low latency audio streaming (primary)
- **WebSocket** - Real-time fallback communication
- **REST API** - HTTP endpoints for session management

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- Modern browser with Web Speech API support
- Microphone access

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd real-time-speech-translator
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

### Production Build

1. **Build the application**

   ```bash
   npm run build
   ```

2. **Start production server**
   ```bash
   npm start
   ```

## 📱 How to Use

### 1. Language Selection

- Choose your **source language** (what you'll speak)
- Choose your **target language** (what you want to see translated)

### 2. Start Listening

- Click the **🎤 Start Listening** button
- Grant microphone permissions when prompted
- Speak clearly into your microphone

### 3. View Results

- **Live Captions** show real-time transcription and translation
- **Transcript History** maintains a scrollable list of all speech
- **Caption Overlay** provides floating captions for screen sharing

### 4. Settings & Controls

- **Punctuation Restoration** - Automatically adds periods, question marks
- **Silence Detection** - Marks pauses in speech
- **Speaker Detection** - Identifies different speakers
- **Caption Delay** - Adjust timing of overlay captions

### 5. Export & Share

- **Export Transcript** - Download complete conversation as JSON
- **Clear Transcript** - Start fresh with new conversation
- **Keyboard Shortcuts** - Use Ctrl/Cmd + Space to control listening

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development
# Add your translation API keys here
GOOGLE_TRANSLATE_API_KEY=your_key_here
AZURE_SPEECH_KEY=your_key_here
```

### Customization

- **Languages**: Add new languages in `app.js` translation mappings
- **UI Colors**: Modify CSS variables in `styles.css`
- **Server Settings**: Adjust WebSocket and API configurations in `server.js`

## 🌐 Browser Support

### Fully Supported

- Chrome 88+
- Edge 88+
- Safari 14.1+
- Firefox 85+

### Partially Supported

- Chrome Mobile 88+
- Safari iOS 14.5+
- Samsung Internet 14+

### Not Supported

- Internet Explorer
- Legacy browsers without Web Speech API

## 📊 Performance Metrics

### Latency Targets

- **WebRTC**: < 100ms end-to-end
- **WebSocket**: < 200ms end-to-end
- **Local Processing**: < 50ms

### Accuracy Targets

- **Speech Recognition**: > 95% for clear speech
- **Translation**: > 90% for common phrases
- **Punctuation**: > 85% for natural speech patterns

## 🔒 Security & Privacy

### Data Handling

- **Local Processing** - Speech processed locally when possible
- **No Storage** - Audio data not stored on servers
- **Encrypted Communication** - WebSocket connections use WSS
- **Permission-Based** - Microphone access requires explicit consent

### Privacy Features

- **Offline Mode** - Works without internet connection
- **Local Storage** - Transcripts stored locally by default
- **Session Isolation** - Meeting data separated by session ID

## 🧪 Testing

### Manual Testing

1. **Speech Recognition** - Test with different accents and speeds
2. **Translation Accuracy** - Verify common phrases in target languages
3. **Latency Measurement** - Use browser dev tools to measure response times
4. **Cross-Browser** - Test on Chrome, Firefox, Safari, Edge

### Automated Testing

```bash
# Run tests (when implemented)
npm test

# Run linting
npm run lint

# Run security audit
npm audit
```

## 🚀 Deployment

### Local Development

```bash
npm run dev
```

### Production Server

```bash
npm run build
npm start
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Cloud Platforms

- **Heroku** - Easy deployment with Git integration
- **Vercel** - Serverless deployment with automatic scaling
- **AWS** - EC2 or Lambda deployment options
- **Google Cloud** - App Engine or Cloud Run

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Add tests if applicable
5. Commit: `git commit -m 'Add feature'`
6. Push: `git push origin feature-name`
7. Submit a pull request

### Code Standards

- Use ES6+ features
- Follow ESLint configuration
- Write meaningful commit messages
- Include JSDoc comments for functions
- Test on multiple browsers

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Web Speech API** - For native speech recognition
- **Socket.IO** - For real-time communication
- **Inter Font** - For beautiful typography
- **Open Source Community** - For inspiration and tools

## 📞 Support

### Issues

- Report bugs via GitHub Issues
- Include browser version and OS details
- Provide steps to reproduce

### Questions

- Check the FAQ section
- Search existing issues
- Create a new issue for questions

### Feature Requests

- Use the "Feature Request" issue template
- Describe the use case and benefits
- Include mockups if applicable

---

**Made with ❤️ for seamless online communication**

_Built for Zoom, Google Meet, Microsoft Teams, and all your online meeting needs._
