# 🤖 WhatsApp Repair Bot — Complete Setup Guide

A production-ready WhatsApp AI bot for electronics repair businesses built with Node.js, whatsapp-web.js, Claude/OpenAI, and Google Sheets.

---

## 📁 Project Structure

```
GPTbot/
├── index.js                          ← App entry point
├── package.json
├── .env                              ← Your secrets (never commit)
├── .env.example                      ← Template
├── Procfile                          ← Railway/Render deployment
│
├── config/
│   ├── constants.js                  ← Business constants
│   └── google-service-account.json   ← Your GCP key (never commit)
│
├── controllers/
│   └── messageController.js          ← Core conversation orchestration
│
├── services/
│   ├── aiService.js                  ← Claude / OpenAI gateway
│   ├── sheetsService.js              ← Google Sheets integration
│   └── whatsappService.js            ← WhatsApp client lifecycle
│
├── routes/
│   └── health.js                     ← GET /health
│
└── utils/
    ├── logger.js                     ← Winston logger
    ├── stateManager.js               ← Per-user conversation state
    └── validators.js                 ← Input validation helpers
```

---

## 🚀 Step 1 — Install Dependencies

```bash
cd "y:\ai agent\GPTbot"
npm install
```

> This installs: whatsapp-web.js, puppeteer, googleapis, @anthropic-ai/sdk, openai, express, winston, dotenv

---

## 🔑 Step 2 — Configure Environment Variables

1. Copy the example file:
   ```bash
   copy .env.example .env
   ```

2. Open `.env` and fill in your values:

   ```env
   AI_PROVIDER=claude                          # or 'openai'
   CLAUDE_API_KEY=sk-ant-...                   # from console.anthropic.com
   GOOGLE_SHEET_ID=1BxiMVs0...                # from your sheet URL
   GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./config/google-service-account.json
   OWNER_PHONE=919876543210                    # your WhatsApp number (no +)
   BUSINESS_NAME=Tech Fix Pro
   ```

---

## 📊 Step 3 — Google Sheets Setup

### A) Create the Sheet

1. Go to [sheets.new](https://sheets.new) — create a new spreadsheet
2. Name it: **Repair Enquiries**
3. Note the **Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/THIS_IS_YOUR_SHEET_ID/edit
   ```
4. Keep the default tab named **Leads** (or set `GOOGLE_SHEET_TAB` in `.env`)

> ✅ The bot auto-creates the header row on first run. No manual column setup needed.

### B) Create a Google Cloud Service Account

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Navigate to: **APIs & Services → Library**
4. Search and **Enable**: `Google Sheets API`
5. Go to: **IAM & Admin → Service Accounts**
6. Click **Create Service Account**:
   - Name: `whatsapp-bot`
   - Role: `Editor`
7. Click the account → **Keys tab → Add Key → Create new key → JSON**
8. **Download** the JSON file
9. **Rename** it to `google-service-account.json`
10. Place it at: `config/google-service-account.json`

### C) Share the Sheet with the Service Account

1. Open your Google Sheet
2. Click **Share**
3. Paste the service account email (found in the JSON: `"client_email"`)
4. Give **Editor** access
5. Click **Done**

---

## 🤖 Step 4 — AI API Setup

### Option A: Claude (Recommended)

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Set in `.env`:
   ```env
   AI_PROVIDER=claude
   CLAUDE_API_KEY=sk-ant-api03-...
   CLAUDE_MODEL=claude-3-5-sonnet-20241022
   ```

### Option B: OpenAI

1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Set in `.env`:
   ```env
   AI_PROVIDER=openai
   OPENAI_API_KEY=sk-proj-...
   OPENAI_MODEL=gpt-4o
   ```

---

## 📱 Step 5 — WhatsApp Setup (QR Authentication)

1. **Start the bot for the first time:**
   ```bash
   npm start
   ```

2. A **QR code** will appear in the terminal

3. Open **WhatsApp** on your phone:
   - Go to **Settings → Linked Devices → Link a Device**
   - Scan the QR code

4. The terminal will show:
   ```
   ✅ Authenticated successfully
   🟢 WhatsApp client is ready and listening
   ```

5. Session data is saved in `.wwebjs_auth/` — **you won't need to scan again** on restart

> ⚠️ Use a **dedicated WhatsApp number** for the bot (not your personal number)

---

## ▶️ Step 6 — Run the Bot

```bash
# Development (with auto-restart on file changes)
npm run dev

# Production
npm start
```

**Check health:**
```
GET http://localhost:3000/health
```

**Check logs:**
```bash
# Live log tail
Get-Content logs/app.log -Wait

# Errors only
Get-Content logs/error.log -Wait
```

---

## 💬 Conversation Flow Example

```
Customer: Hi, my laptop is not turning on

Bot: Hi there! 👋 Sorry to hear about your laptop. I can definitely help 
     you with that repair. To get started, could you please share:
     
     1️⃣ Your Name
     2️⃣ Company Name (or NA)
     3️⃣ Address
     4️⃣ Phone Number
     5️⃣ Device Type
     6️⃣ Model/Brand Name
     7️⃣ The Issue
     8️⃣ More Details

Customer: John, ABC Corp, Mumbai, 9876543210, Dell Inspiron 15, won't power on

Bot: ✅ Please confirm your details before I save your enquiry:
     
     👤 Name: John
     🏢 Company: ABC Corp
     📱 Device: Laptop
     🔧 Issue: won't power on
     
     Reply YES to confirm or EDIT to make changes.

Customer: YES

Bot: 🎉 Enquiry saved successfully! Our team will contact you shortly.

[Owner receives WhatsApp notification with all details]
[Google Sheet gets a new row appended automatically]
```

---

## ☁️ Step 7 — Deploy to Railway

1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. Create project:
   ```bash
   railway init
   railway up
   ```

3. Set environment variables in Railway dashboard (same as `.env`)

4. **Important for Railway/Render:** WhatsApp requires a persistent disk for session storage. In Railway:
   - Go to your service → **Settings → Volumes**
   - Mount `/app/.wwebjs_auth` as persistent volume

5. First deploy: Check Railway logs for QR code, scan it once

### Alternative: Render

1. Push code to GitHub (without `.env` and `google-service-account.json`)
2. Connect repo on [render.com](https://render.com)
3. Set `Build Command`: `npm install`
4. Set `Start Command`: `node index.js`
5. Add all environment variables in Render dashboard
6. Use **Render Disk** (paid plan) or external session store for WhatsApp auth

---

## 🔧 Troubleshooting

| Problem | Fix |
|---|---|
| QR code not showing | Check puppeteer installation: `npm install puppeteer` |
| "Cannot find module" | Run `npm install` again |
| Sheets permission denied | Check service account email is added as Editor to sheet |
| AI returns invalid JSON | Check API key is valid and has credits |
| Bot not responding | Check `logs/app.log` for errors |
| Session expired | Delete `.wwebjs_auth/` folder and re-scan QR |

---

## 🔐 Security Checklist

- [ ] `.env` is in `.gitignore` ✅
- [ ] `google-service-account.json` is in `.gitignore` ✅
- [ ] Using a dedicated WhatsApp number (not personal)
- [ ] API keys stored only in `.env` / deployment env vars
- [ ] Logs don't contain API keys

---

## 📞 Support

For issues with this bot, check `logs/error.log` first.
