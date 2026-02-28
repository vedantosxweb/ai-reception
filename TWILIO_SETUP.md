# 🚀 AI Receptionist - Complete Twilio Setup Guide

## ✅ Your Twilio Account is NOW CONFIGURED!

Your Twilio credentials have been added to the `.env` file:

```
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

```

---

## 📞 Step-by-Step Webhook Configuration

### Step 1: Deploy Your Application

Your app needs to be accessible from the internet for Twilio to reach it.

#### Option A: Use Ngrok (Quick Testing)

```bash
# Install ngrok
npm install -g ngrok

# In one terminal, your app is already running on port 3000
# In another terminal:
ngrok http 3000

# You'll get a URL like: https://abc123.ngrok.io
```

#### Option B: Deploy to Vercel (Production)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# You'll get a URL like: https://ai-receptionist.vercel.app
```

---

### Step 2: Configure Twilio Webhooks

Go to: https://www.twilio.com/console/phone-numbers/incoming

Click on your phone number **+16413632067**

#### Voice & Fax Settings:

| Setting | URL |
|---------|-----|
| **A CALL COMES IN** | `https://YOUR-DOMAIN/api/twilio/voice` |
| **Primary Handler Fails** | Leave empty |
| **Call Status Changes** | `https://YOUR-DOMAIN/api/twilio/status` |

**Example with ngrok:**
```
https://abc123.ngrok.io/api/twilio/voice
```

**Example with Vercel:**
```
https://ai-receptionist.vercel.app/api/twilio/voice
```

#### HTTP Method: POST

---

### Step 3: Test Your Integration

#### Test 1: Make a Test Call

1. Open your application in the browser
2. Go to **Voice** tab
3. Enter your cell phone number
4. Click the green call button
5. You should receive a call!

#### Test 2: Receive a Call

1. Call your Twilio number: **+1-641-363-2067**
2. The AI will answer with a greeting
3. Speak naturally - the AI will respond!
4. Try saying: "I want to book an appointment"

---

## 🎯 What Happens When Someone Calls

```
┌─────────────────────────────────────────────────────────────────┐
│                      INCOMING CALL FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Caller dials +16413632067                                   │
│  2. Twilio sends webhook to /api/twilio/voice                   │
│  3. AI greets caller with:                                      │
│     "Hello! Thank you for calling..."                           │
│  4. Twilio gathers speech input                                 │
│  5. Speech is sent to AI for processing                         │
│  6. AI generates intelligent response                           │
│  7. Response is converted to speech (TTS)                       │
│  8. Caller hears the response                                   │
│  9. Conversation continues until resolved                       │
│ 10. Call ends, transcript saved to database                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 What Gets Tracked

Every call automatically logs:

| Data | Description |
|------|-------------|
| **Phone Number** | Caller's phone |
| **Duration** | How long the call lasted |
| **Transcript** | Full conversation text |
| **Intent** | What the caller wanted (booking, support, etc.) |
| **Sentiment** | Positive, neutral, or negative |
| **Resolution** | Was the issue resolved? |
| **Recording** | Audio recording (if enabled) |

All this data appears in your **Dashboard** and **CRM**!

---

## 🔧 Advanced Twilio Features

### Enable Call Recording

Go to Twilio Console → Phone Numbers → Your Number → Voice

Check: "Record all calls"

Recordings will be saved and transcribed automatically.

### Set Up SMS

Add to your Twilio webhook:

| Setting | URL |
|---------|-----|
| **A MESSAGE COMES IN** | `https://YOUR-DOMAIN/api/twilio/sms` |

### Add Voice Mail

If no one answers after hours, callers can leave a voicemail:

1. Go to Settings → Business Hours
2. Configure after-hours greeting
3. Enable voicemail recording

---

## 📱 Testing Commands

### Test AI Response
```bash
# Test the chat API
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "I want to book an appointment for tomorrow"}'
```

### Test Outbound Call
```bash
# Make a test call
curl -X POST http://localhost:3000/api/calls \
  -H "Content-Type: application/json" \
  -d '{"to": "+1234567890", "message": "Hello from AI Receptionist!"}'
```

---

## 🌐 WhatsApp Business API Setup (Next Step)

To add WhatsApp:

1. Go to: https://business.facebook.com
2. Create a Business account
3. Set up WhatsApp Business API
4. Get your credentials:
   - Access Token
   - Phone Number ID
   - Webhook Verify Token

5. Add to `.env`:
```
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify_token
```

---

## ❓ Troubleshooting

### Call doesn't connect
- Check webhook URL in Twilio console
- Ensure app is deployed and accessible
- Check logs: `tail -f /home/z/my-project/dev.log`

### No audio / Can't hear
- Check Twilio console for errors
- Verify TwiML is correct
- Test with simple TwiML first

### Speech recognition issues
- Check speech timeout settings
- Try different speech models
- Verify language is set to "en-US"

---

## 🎉 You're Ready!

Your AI Receptionist is now:
- ✅ Connected to your Twilio number (+16413632067)
- ✅ Ready to handle incoming calls
- ✅ Logging all conversations
- ✅ Scoring leads automatically
- ✅ Detecting sentiment and intent

**Just configure the webhook URL in Twilio and you're live!**
