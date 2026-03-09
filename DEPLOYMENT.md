# AI Receptionist - Deployment Guide

## 🚀 Complete Setup & Deployment

### Prerequisites
- Node.js 18+ or Bun runtime
- Git installed
- Vercel CLI (optional, for deployment)

---

## 📦 Local Development Setup

### Step 1: Install Dependencies
```bash
# Using npm
npm install

# OR using Bun (faster)
bun install
```

### Step 2: Setup Database
```bash
npm run db:push
# OR
bun run db:push
```

### Step 3: Environment Variables
Your `.env` file should be configured with:
```env
DATABASE_URL=file:/home/z/my-project/db/custom.db

# OpenAI API (for AI Chat)
OPENAI_API_KEY=YOUR_OPENAI_API_KEY_HERE

# Twilio (for Voice & SMS)
TWILIO_ACCOUNT_SID=YOUR_ACCOUNT_SID_HERE
TWILIO_AUTH_TOKEN=YOUR_AUTH_TOKEN_HERE
TWILIO_PHONE_NUMBER=YOUR_TWILIO_PHONE_NUMBER

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 4: Run Development Server
```bash
npm run dev
# OR
bun run dev
```

### Step 5: Open in Browser
Navigate to `http://localhost:3000`

---

## 🌐 Production Deployment (Vercel)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```

### Step 3: Deploy
```bash
# First deployment
vercel

# For production deployment
vercel --prod
```

### Step 4: Add Environment Variables in Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `file:/home/z/my-project/db/custom.db` (or use a production DB) |
| `OPENAI_API_KEY` | Get from https://platform.openai.com/api-keys |
| `TWILIO_ACCOUNT_SID` | Get from https://console.twilio.com |
| `TWILIO_AUTH_TOKEN` | Get from https://console.twilio.com |
| `TWILIO_PHONE_NUMBER` | Get from https://console.twilio.com |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |
| `ENABLE_SMS` | `true` |
| `TWILIO_WEBHOOK_STRICT_VALIDATION` | `true` (recommended in production) |
| `ENCRYPTION_KEY` | Generate with `openssl rand -hex 32` |

### Step 5: Redeploy
After adding environment variables, redeploy:
```bash
vercel --prod
```

---

## 📞 Configure Twilio Webhooks

### Step 1: Get Your Production URL
After deploying to Vercel, copy your URL (e.g., `https://ai-receptionist.vercel.app`)

### Step 2: Configure in Twilio Console
1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → **Manage** → **Active Numbers**
3. Click on your number: `YOUR_TWILIO_PHONE_NUMBER`
4. Configure the following:

#### Voice Configuration
| Setting | URL |
|---------|-----|
| **Voice URL** | `https://your-app.vercel.app/api/webhooks/twilio/voice` |
| **Status Callback URL** | `https://your-app.vercel.app/api/webhooks/twilio/status` |
| **HTTP Method** | POST |

#### Messaging Configuration
| Setting | URL |
|---------|-----|
| **Webhook URL** | `https://your-app.vercel.app/api/webhooks/twilio/sms` |
| **HTTP Method** | POST |

### Step 3: Save Changes
Click **Save** at the bottom of the page.

---

## 🧪 Testing

### Test AI Chat
1. Open your app
2. Go to **AI Receptionist** tab
3. Send a message like "Hello, I'd like to book an appointment"
4. The AI should respond with intelligent suggestions

### Test Voice Calls
1. Call your Twilio number: `YOUR_TWILIO_PHONE_NUMBER`
2. The AI Receptionist will answer
3. Speak naturally - the AI will understand and respond

### Test SMS
1. Send an SMS to `YOUR_TWILIO_PHONE_NUMBER`
2. The AI will respond intelligently

---

## 📱 Features Overview

| Feature | Status | Description |
|---------|--------|-------------|
| ✅ AI Chat | Ready | OpenAI GPT-4o powered conversations |
| ✅ Dashboard | Ready | Analytics and KPIs |
| ✅ CRM | Ready | Contacts, appointments, services |
| ✅ Dark Theme | Ready | Toggle between light/dark |
| ✅ Mobile | Ready | Fully responsive design |
| ✅ Voice | Configure Webhooks | Twilio integration |
| ✅ SMS | Configure Webhooks | Twilio messaging |

---

## 🔧 Troubleshooting

### AI Chat Not Working
```bash
# Check server logs
npm run dev

# Look for errors in console
# Common issues:
# - OPENAI_API_KEY not set
# - Invalid API key
# - Network issues
```

### Database Issues
```bash
# Reset database
rm prisma/dev.db
npm run db:push
```

### Twilio Not Receiving Calls
1. Verify webhook URL is correct
2. Check Twilio Console → Monitor → Logs
3. Ensure your app is deployed and accessible

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules
rm -rf .next
npm install
npm run dev
```

---

## 📊 Performance Optimization

### Already Implemented
- ✅ Server-side API routes
- ✅ Prisma ORM with SQLite
- ✅ Framer Motion animations
- ✅ Responsive design
- ✅ Dark/Light theme

### Recommended for Production
- Use a production database (PostgreSQL/MySQL)
- Enable Vercel Analytics
- Set up monitoring (Sentry)
- Configure rate limiting

---

## 🔐 Security Best Practices

1. **Never commit `.env` file** - Already in `.gitignore`
2. **Rotate API keys** periodically
3. **Use environment variables** for all secrets
4. **Enable Twilio signature validation** in production
5. **Rate limit API endpoints** to prevent abuse

---

## 📞 Support

For issues or questions:
1. Check the browser console for errors
2. Check the server logs
3. Verify environment variables are set
4. Ensure API keys are valid

---

## 🎉 You're All Set!

Your AI Receptionist is now ready for production use!

**Your Twilio Number:** YOUR_TWILIO_PHONE_NUMBER
**Features:** Voice, SMS, AI Chat, CRM, Dashboard
**AI Model:** OpenAI GPT-4o-mini
