const { Translate } = require('@google-cloud/translate').v2;
const axios = require('axios');
const NodeCache = require('node-cache');

class TranslationService {
    constructor() {
        this.cache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour
        this.googleTranslate = null;
        this.currentService = 'google'; // Primary service
        this.fallbackServices = ['azure', 'deepl', 'microsoft'];
        this.serviceIndex = 0;

        // Rate limiting and monitoring
        this.requestCounts = new Map();
        this.serviceHealth = new Map();
        this.lastHealthCheck = Date.now();

        this.initializeServices();
        this.startHealthMonitoring();
    }

    async initializeServices() {
        try {
            // Initialize Google Translate if API key is available
            if (process.env.GOOGLE_TRANSLATE_API_KEY) {
                this.googleTranslate = new Translate({
                    key: process.env.GOOGLE_TRANSLATE_API_KEY
                });
                console.log('✅ Google Translate API initialized');
                this.serviceHealth.set('google', { status: 'healthy', lastCheck: Date.now() });
            } else {
                console.log('⚠️ Google Translate API key not found');
                this.serviceHealth.set('google', { status: 'unconfigured', lastCheck: Date.now() });
            }
        } catch (error) {
            console.error('❌ Failed to initialize Google Translate:', error.message);
            this.serviceHealth.set('google', { status: 'error', lastCheck: Date.now(), error: error.message });
        }

        // Check other services
        this.checkServiceHealth('azure');
        this.checkServiceHealth('deepl');
        this.checkServiceHealth('microsoft');
    }

    async checkServiceHealth(service) {
        const health = { status: 'unknown', lastCheck: Date.now() };

        try {
            switch (service) {
                case 'azure':
                    if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) {
                        health.status = 'configured';
                    } else {
                        health.status = 'unconfigured';
                    }
                    break;
                case 'deepl':
                    if (process.env.DEEPL_API_KEY) {
                        health.status = 'configured';
                    } else {
                        health.status = 'unconfigured';
                    }
                    break;
                case 'microsoft':
                    if (process.env.MICROSOFT_TRANSLATOR_KEY) {
                        health.status = 'configured';
                    } else {
                        health.status = 'unconfigured';
                    }
                    break;
            }
        } catch (error) {
            health.status = 'error';
            health.error = error.message;
        }

        this.serviceHealth.set(service, health);
    }

    startHealthMonitoring() {
        // Check service health every 5 minutes
        setInterval(() => {
            this.fallbackServices.forEach(service => this.checkServiceHealth(service));
            this.lastHealthCheck = Date.now();
        }, 5 * 60 * 1000);
    }

    async translateText(text, sourceLanguage, targetLanguage) {
        if (!text || !targetLanguage) {
            throw new Error('Text and target language are required');
        }

        // Check cache first
        const cacheKey = `${text}_${sourceLanguage}_${targetLanguage}`;
        const cachedResult = this.cache.get(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }

        // Rate limiting check
        if (this.isRateLimited()) {
            throw new Error('Rate limit exceeded. Please try again later.');
        }

        // Try primary service first
        try {
            const result = await this.translateWithGoogle(text, sourceLanguage, targetLanguage);
            this.cache.set(cacheKey, result);
            this.incrementRequestCount('google');
            return result;
        } catch (error) {
            console.log(`Google Translate failed: ${error.message}, trying fallback services...`);

            // Try fallback services
            for (const service of this.fallbackServices) {
                try {
                    if (this.serviceHealth.get(service)?.status === 'configured') {
                        const result = await this.translateWithFallback(service, text, sourceLanguage, targetLanguage);
                        if (result) {
                            this.cache.set(cacheKey, result);
                            this.incrementRequestCount(service);
                            return result;
                        }
                    }
                } catch (fallbackError) {
                    console.log(`${service} fallback failed: ${fallbackError.message}`);
                    this.updateServiceHealth(service, 'error', fallbackError.message);
                }
            }

            // If all services fail, return a fallback message
            return `[${targetLanguage.toUpperCase()}] ${text}`;
        }
    }

    isRateLimited() {
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute window
        const maxRequests = 100; // Max 100 requests per minute

        // Clean old entries
        for (const [timestamp] of this.requestCounts) {
            if (now - timestamp > windowMs) {
                this.requestCounts.delete(timestamp);
            }
        }

        // Count requests in current window
        const currentRequests = Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0);
        return currentRequests >= maxRequests;
    }

    incrementRequestCount(service) {
        const now = Date.now();
        const currentCount = this.requestCounts.get(now) || 0;
        this.requestCounts.set(now, currentCount + 1);
    }

    updateServiceHealth(service, status, error = null) {
        const health = this.serviceHealth.get(service) || {};
        health.status = status;
        health.lastCheck = Date.now();
        if (error) health.error = error;
        this.serviceHealth.set(service, health);
    }

    async translateWithGoogle(text, sourceLanguage, targetLanguage) {
        if (!this.googleTranslate) {
            throw new Error('Google Translate not initialized');
        }

        const [translation] = await this.googleTranslate.translate(text, {
            from: sourceLanguage || 'auto',
            to: targetLanguage
        });

        return translation;
    }

    async translateWithFallback(service, text, sourceLanguage, targetLanguage) {
        switch (service) {
            case 'azure':
                return await this.translateWithAzure(text, sourceLanguage, targetLanguage);
            case 'deepl':
                return await this.translateWithDeepL(text, sourceLanguage, targetLanguage);
            case 'microsoft':
                return await this.translateWithMicrosoft(text, sourceLanguage, targetLanguage);
            default:
                throw new Error(`Unknown service: ${service}`);
        }
    }

    async translateWithAzure(text, sourceLanguage, targetLanguage) {
        if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
            throw new Error('Azure Speech credentials not configured');
        }

        const endpoint = `https://${process.env.AZURE_SPEECH_REGION}.api.cognitive.microsofttranslator.com/translate`;
        const response = await axios.post(endpoint, [{
            text: text
        }], {
            params: {
                'api-version': '3.0',
                'from': sourceLanguage || 'auto',
                'to': targetLanguage
            },
            headers: {
                'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
                'Content-Type': 'application/json',
                'X-ClientTraceId': this.generateUUID()
            },
            timeout: 10000 // 10 second timeout
        });

        return response.data[0].translations[0].text;
    }

    async translateWithDeepL(text, sourceLanguage, targetLanguage) {
        if (!process.env.DEEPL_API_KEY) {
            throw new Error('DeepL API key not configured');
        }

        const response = await axios.post('https://api-free.deepl.com/v2/translate', {
            text: [text],
            source_lang: sourceLanguage || 'AUTO',
            target_lang: targetLanguage.toUpperCase()
        }, {
            headers: {
                'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 second timeout
        });

        return response.data.translations[0].text;
    }

    async translateWithMicrosoft(text, sourceLanguage, targetLanguage) {
        if (!process.env.MICROSOFT_TRANSLATOR_KEY) {
            throw new Error('Microsoft Translator key not configured');
        }

        const endpoint = 'https://api.cognitive.microsofttranslator.com/translate';
        const response = await axios.post(endpoint, [{
            text: text
        }], {
            params: {
                'api-version': '3.0',
                'from': sourceLanguage || 'auto',
                'to': targetLanguage
            },
            headers: {
                'Ocp-Apim-Subscription-Key': process.env.MICROSOFT_TRANSLATOR_KEY,
                'Content-Type': 'application/json',
                'X-ClientTraceId': this.generateUUID()
            },
            timeout: 10000 // 10 second timeout
        });

        return response.data[0].translations[0].text;
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    getSupportedLanguages() {
        return {
            'en': 'English',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'zh': 'Chinese (Simplified)',
            'ar': 'Arabic',
            'hi': 'Hindi',
            'nl': 'Dutch',
            'sv': 'Swedish',
            'no': 'Norwegian',
            'da': 'Danish',
            'fi': 'Finnish',
            'pl': 'Polish',
            'tr': 'Turkish',
            'he': 'Hebrew'
        };
    }

    getServiceStatus() {
        return {
            google: this.serviceHealth.get('google')?.status || 'unknown',
            azure: this.serviceHealth.get('azure')?.status || 'unknown',
            deepl: this.serviceHealth.get('deepl')?.status || 'unknown',
            microsoft: this.serviceHealth.get('microsoft')?.status || 'unknown'
        };
    }

    getDetailedServiceStatus() {
        const status = {};
        for (const [service, health] of this.serviceHealth) {
            status[service] = {
                ...health,
                lastCheck: new Date(health.lastCheck).toISOString()
            };
        }
        return status;
    }

    getRequestStats() {
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute window
        let totalRequests = 0;

        for (const [timestamp, count] of this.requestCounts) {
            if (now - timestamp <= windowMs) {
                totalRequests += count;
            }
        }

        return {
            totalRequests,
            windowMs,
            isRateLimited: this.isRateLimited()
        };
    }

    clearCache() {
        this.cache.flushAll();
        console.log('Translation cache cleared');
    }

    async testService(service) {
        try {
            const testText = 'Hello world';
            const result = await this.translateWithFallback(service, testText, 'en', 'es');
            this.updateServiceHealth(service, 'healthy');
            return { success: true, result };
        } catch (error) {
            this.updateServiceHealth(service, 'error', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = TranslationService;
