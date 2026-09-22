# 💕 Romantic Apology Website

A complete, production-ready interactive apology website built with Flask, Firebase, and pure HTML/CSS/JS.

---

## ✨ Features

- Full-screen romantic landing page with glassmorphism card
- Animated floating hearts & ambient star particles
- Playful NO button that moves around the screen (without being coercive)
- Rotating cute messages when the NO button is dodged
- YES button triggers a heart/confetti explosion
- Forgiveness celebration card with personal message form
- Optional background music player
- All interactions logged to Firebase Realtime Database
- Secure: Firebase credentials only on the server, never in the browser

---

## 📁 Project Structure

```
apology-website/
├── app.py                         ← Flask application
├── requirements.txt               ← Python dependencies
├── .env                           ← Environment variables (never commit)
├── .gitignore
├── README.md
├── firebase/
│   └── serviceAccountKey.json     ← Firebase Admin key (never commit)
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── style.css
    ├── js/
    │   └── app.js
    ├── images/
    └── music/
        └── song.mp3               ← Add your MP3 here
```

---

## 🚀 Installation

### 1. Clone / copy the project

```bash
cd apology-website
```

### 2. Create and activate a virtual environment

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**macOS / Linux:**
```bash
python -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Add your Firebase Service Account Key

The file is already placed at:
```
firebase/serviceAccountKey.json
```

If you need to replace it, download a new one from:  
**Firebase Console → Project Settings → Service Accounts → Generate new private key**

### 5. Configure environment variables

Edit the `.env` file:

```env
FIREBASE_CREDENTIALS_PATH=firebase/serviceAccountKey.json
FIREBASE_DATABASE_URL=https://doudou-a43fb-default-rtdb.firebaseio.com
FLASK_SECRET_KEY=change-this-to-a-random-secret-in-production
FLASK_ENV=development
FLASK_DEBUG=True
MAX_MESSAGE_LENGTH=500
```

> **Important:** Never commit `.env` or `firebase/serviceAccountKey.json` to Git!

### 6. Add background music (optional)

Copy your MP3 file to:
```
static/music/song.mp3
```

If no file is present, the music button will simply not play – the rest of the website works perfectly.

### 7. Run the development server

```bash
python app.py
```

Open in browser:
```
http://127.0.0.1:5000
```

---

## 🔥 Firebase Setup

### Step 1 – Create / use your project

Your Firebase project ID: **doudou-a43fb**

Go to the [Firebase Console](https://console.firebase.google.com/) and open this project.

### Step 2 – Enable Realtime Database

1. In the left sidebar, click **Build → Realtime Database**
2. Click **Create Database**
3. Choose a region (e.g., `us-central1`)
4. Start in **test mode** (you can lock it down later)

> The database URL should be: `https://doudou-a43fb-default-rtdb.firebaseio.com`

### Step 3 – Database Security Rules

For production, replace the default rules with:

```json
{
  "rules": {
    "sessions": {
      "$session_id": {
        ".read":  false,
        ".write": false
      }
    }
  }
}
```

This blocks all direct client-side access. Only the server (via Admin SDK) can write.

### Step 4 – Verify the service account key

Your key is already in `firebase/serviceAccountKey.json`.  
It authenticates the Flask server to Firebase.

---

## 🗄️ Firebase Database Structure

```json
{
  "sessions": {
    "uuid-session-id": {
      "started_at": "2024-01-01T12:00:00+00:00",
      "final_response": "YES",
      "responded_at": "2024-01-01T12:05:30+00:00",
      "message": "I forgive you because I love you.",
      "message_sent_at": "2024-01-01T12:06:00+00:00",
      "events": {
        "-NxAbc123": { "type": "PAGE_OPEN",   "timestamp": "..." },
        "-NxAbc124": { "type": "NO_ATTEMPT",  "timestamp": "..." },
        "-NxAbc125": { "type": "YES_CLICK",   "timestamp": "..." },
        "-NxAbc126": { "type": "MESSAGE_SENT","timestamp": "..." }
      }
    }
  }
}
```

---

## 🔌 REST API Reference

### `GET /`
Renders the main page.

### `POST /api/event`
Track an interaction event.
```json
{ "session_id": "uuid", "event": "NO_ATTEMPT" }
```
Valid event types: `PAGE_OPEN`, `NO_ATTEMPT`, `NO_CLICK`, `YES_CLICK`, `MESSAGE_SENT`

### `POST /api/response`
Record the final YES/NO.
```json
{ "session_id": "uuid", "response": "YES" }
```

### `POST /api/message`
Save her personal message.
```json
{ "session_id": "uuid", "message": "I love you too." }
```

### `GET /api/health`
Health check.
```json
{ "status": "ok", "firebase": true, "timestamp": "..." }
```

---

## 🚀 Deployment

### Option A – Render (free tier, supports Python/Flask)

1. Create a free account at [render.com](https://render.com)
2. Click **New → Web Service**
3. Connect your GitHub repository
4. Set:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
5. Add environment variables in the Render dashboard (same as `.env`)
6. Upload `serviceAccountKey.json` content as a secret file or env var

### Option B – Railway (free tier)

1. Create account at [railway.app](https://railway.app)
2. New project → Deploy from GitHub
3. Set environment variables in Railway dashboard
4. Start command: `gunicorn app:app`

### Option C – PythonAnywhere (free tier)

1. Create account at [pythonanywhere.com](https://www.pythonanywhere.com)
2. Upload project files
3. Set up a new Web App with Flask
4. Install requirements in the bash console
5. Set environment variables in the WSGI configuration

### Gunicorn (production server)

```bash
gunicorn --workers 2 --bind 0.0.0.0:8000 app:app
```

---

## 🔐 Security Notes

- `serviceAccountKey.json` is in `.gitignore` – never commit it
- `.env` is in `.gitignore` – never commit it
- Firebase Admin SDK only runs on the server
- No Firebase credentials are ever sent to the browser
- Message length is enforced server-side (500 chars max)
- Event types are whitelisted server-side
- Response values are whitelisted server-side

---

## 🎵 Adding Music

1. Find an MP3 of your shared song
2. Rename it to `song.mp3`
3. Place it at: `static/music/song.mp3`
4. The music button will appear automatically

---

## ❤️ Made with love
