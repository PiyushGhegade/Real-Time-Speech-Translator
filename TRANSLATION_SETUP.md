# 🚀 Translation API Setup Guide

This guide will help you set up real translation APIs to replace the hardcoded translation system.

## 📋 Prerequisites

- Node.js 16+ installed
- npm or yarn package manager
- API keys for translation services (see below)

## 🔑 Required API Keys

### 1. Google Cloud Translation API (Recommended - Primary Service)

**Get your API key:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the "Cloud Translation API"
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy your API key

**Cost:** $20 per 1 million characters (very affordable)

### 2. Azure Cognitive Services Translator (Fallback 1)

**Get your API key:**

1. Go to [Azure Portal](https://portal.azure.com/)
2. Create a new "Cognitive Services" resource
3. Choose "Translator" service
4. Copy the "Key" and "Region" from your resource

**Cost:** $10 per 1 million characters

### 3. DeepL API (Fallback 2 - Best for European Languages)

**Get your API key:**

1. Go to [DeepL Pro](https://www.deepl.com/pro-api)
2. Sign up for a free account
3. Get your API key from the dashboard

**Cost:** Free tier available, then €5.49 per 1 million characters

### 4. Microsoft Translator (Fallback 3)

**Get your API key:**

1. Go to [Azure Cognitive Services](https://azure.microsoft.com/en-us/services/cognitive-services/translator/)
2. Create a Translator resource
3. Copy your API key

**Cost:** $10 per 1 million characters

## ⚙️ Configuration

### Step 1: Create Environment File

Copy your `env.example` file to `.env`:

```bash
cp env.example .env
```

### Step 2: Add Your API Keys

Edit the `.env` file and add your actual API keys:

```env
# Google Cloud Translation API (Primary)
GOOGLE_TRANSLATE_API_KEY=your_actual_google_api_key_here

# Azure Cognitive Services (Fallback 1)
AZURE_SPEECH_KEY=your_actual_azure_key_here
AZURE_SPEECH_REGION=your_azure_region_here

# DeepL API (Fallback 2)
DEEPL_API_KEY=your_actual_deepl_api_key_here

# Microsoft Translator (Fallback 3)
MICROSOFT_TRANSLATOR_KEY=your_actual_microsoft_key_here
```

### Step 3: Install Dependencies

```bash
npm install
```

## 🧪 Testing Your Setup

### 1. Start the Server

```bash
npm start
```

### 2. Check Service Status

Visit: `http://localhost:3000/api/translation/status`

You should see the status of all your configured services.

### 3. Test Translation

Visit: `http://localhost:3000/api/translation/test`

Send a POST request with:

```json
{
  "text": "Hello world",
  "sourceLanguage": "en",
  "targetLanguage": "es"
}
```

### 4. Test Individual Services

Test each service individually:

- `POST /api/translation/test-service/azure`
- `POST /api/translation/test-service/deepl`
- `POST /api/translation/test-service/microsoft`

## 🔍 Monitoring & Debugging

### Health Check Endpoints

- **Service Status:** `GET /api/translation/services`
- **Health Check:** `GET /api/health`
- **Supported Languages:** `GET /api/translation/languages`
- **Clear Cache:** `POST /api/translation/clear-cache`

### Console Logs

Watch your server console for:

- ✅ Service initialization messages
- ⚠️ Missing API key warnings
- ❌ Service errors
- 🔄 Fallback service usage

## 🚨 Troubleshooting

### Common Issues

1. **"API key not found"**

   - Check your `.env` file exists
   - Verify API key names match exactly
   - Restart server after changing `.env`

2. **"Service not configured"**

   - Add the missing API key to `.env`
   - Check API key format and validity

3. **"Rate limit exceeded"**

   - Wait 1 minute before retrying
   - Check your API service quotas

4. **"Translation timeout"**
   - Check internet connection
   - Verify API service is accessible
   - Check firewall settings

### Service-Specific Issues

#### Google Translate

- Ensure "Cloud Translation API" is enabled
- Check billing is set up
- Verify API key has correct permissions

#### Azure Translator

- Check resource is in correct region
- Verify "Translator" service type
- Ensure subscription is active

#### DeepL

- Check free tier limits
- Verify API key format
- Check account status

#### Microsoft Translator

- Ensure resource is active
- Check API version compatibility
- Verify subscription status

## 💰 Cost Optimization

### Recommended Setup for Production

1. **Primary:** Google Translate (best value, 200+ languages)
2. **Fallback 1:** Azure Translator (good reliability)
3. **Fallback 2:** DeepL (best quality for European languages)
4. **Fallback 3:** Microsoft Translator (backup)

### Cost Estimates (per 1 million characters)

- **Google:** $20
- **Azure:** $10
- **DeepL:** €5.49 (~$6)
- **Microsoft:** $10

### Monthly Usage Examples

- **Light usage (100k chars):** $2-4/month
- **Medium usage (1M chars):** $20-40/month
- **Heavy usage (10M chars):** $200-400/month

## 🔒 Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use environment variables** in production
3. **Rotate API keys** regularly
4. **Monitor usage** to detect abuse
5. **Set up alerts** for quota limits

## 📱 Production Deployment

### Environment Variables

Set these in your production environment:

```bash
export GOOGLE_TRANSLATE_API_KEY="your_production_key"
export AZURE_SPEECH_KEY="your_production_key"
export AZURE_SPEECH_REGION="your_production_region"
export DEEPL_API_KEY="your_production_key"
export MICROSOFT_TRANSLATOR_KEY="your_production_key"
```

### Docker Example

```dockerfile
# Add to your Dockerfile
ENV GOOGLE_TRANSLATE_API_KEY=your_key
ENV AZURE_SPEECH_KEY=your_key
ENV AZURE_SPEECH_REGION=your_region
ENV DEEPL_API_KEY=your_key
ENV MICROSOFT_TRANSLATOR_KEY=your_key
```

## 🎯 Next Steps

1. **Test all services** individually
2. **Monitor performance** and costs
3. **Set up alerts** for service failures
4. **Implement caching** strategies
5. **Add rate limiting** if needed

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify API keys and permissions
3. Test services individually
4. Check service status endpoints
5. Review server console logs

---

**🎉 Congratulations!** You now have a production-ready translation system with multiple fallback services, caching, and monitoring.

