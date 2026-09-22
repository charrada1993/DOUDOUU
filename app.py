"""
Romantic Apology Website - Flask Backend
Firebase Admin SDK is only used server-side. Credentials are never exposed to the browser.
"""

import os
import sys
import json

# Ensure UTF-8 output on Windows consoles
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from datetime import datetime, timezone

from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

import firebase_admin
from firebase_admin import credentials, db

# ── Load environment variables ──────────────────────────────────────────────
load_dotenv()

# ── Flask app setup ──────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "fallback-secret-key")

# ── Constants ────────────────────────────────────────────────────────────────
MAX_MESSAGE_LENGTH = int(os.getenv("MAX_MESSAGE_LENGTH", 500))

ALLOWED_EVENTS = {
    "PAGE_OPEN",
    "NO_ATTEMPT",
    "NO_CLICK",
    "YES_CLICK",
    "MESSAGE_SENT",
}

ALLOWED_RESPONSES = {"YES", "NO"}

# ── Firebase initialisation ──────────────────────────────────────────────────
# Supports two modes:
#   1. FIREBASE_SERVICE_ACCOUNT_JSON  – raw JSON string (used on Render / cloud)
#   2. FIREBASE_CREDENTIALS_PATH      – local file path (used in development)
firebase_available = False

try:
    database_url = os.getenv(
        "FIREBASE_DATABASE_URL",
        "https://doudou-a43fb-default-rtdb.firebaseio.com"
    )

    raw_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    if raw_json.strip():
        # Mode 1: credentials supplied as a JSON string env var (Render / cloud)
        service_account_info = json.loads(raw_json)
        cred = credentials.Certificate(service_account_info)
        print("[Firebase] Using credentials from FIREBASE_SERVICE_ACCOUNT_JSON env var")
    else:
        # Mode 2: credentials loaded from local file (development)
        cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase/serviceAccountKey.json")
        cred = credentials.Certificate(cred_path)
        print(f"[Firebase] Using credentials from file: {cred_path}")

    firebase_admin.initialize_app(cred, {"databaseURL": database_url})
    firebase_available = True
    print("[Firebase] OK - Connected to Firebase Realtime Database")
except Exception as e:
    print(f"[Firebase] WARNING - Could not initialise Firebase: {str(e)[:200]}")
    print("[Firebase] The website will continue working without persistence.")


# ── Helpers ──────────────────────────────────────────────────────────────────

def now_iso() -> str:
    """Return current UTC time as ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


def write_to_firebase(path: str, data: dict) -> bool:
    """Write data to a Firebase path. Returns True on success."""
    if not firebase_available:
        return False
    try:
        db.reference(path).set(data)
        return True
    except Exception as e:
        print(f"[Firebase] Write error at {path}: {str(e)[:120]}")
        return False


def push_to_firebase(path: str, data: dict) -> bool:
    """Push (append) data to a Firebase list. Returns True on success."""
    if not firebase_available:
        return False
    try:
        db.reference(path).push(data)
        return True
    except Exception as e:
        print(f"[Firebase] Push error at {path}: {str(e)[:120]}")
        return False


def update_firebase(path: str, data: dict) -> bool:
    """Update specific fields at a Firebase path. Returns True on success."""
    if not firebase_available:
        return False
    try:
        db.reference(path).update(data)
        return True
    except Exception as e:
        print(f"[Firebase] Update error at {path}: {str(e)[:120]}")
        return False


def validate_session_id(session_id: str) -> bool:
    """Basic validation: must be a non-empty string under 128 characters."""
    return isinstance(session_id, str) and 1 <= len(session_id) <= 128


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the main apology page."""
    return render_template("index.html")


@app.route("/api/event", methods=["POST"])
def api_event():
    """
    Track an interaction event.

    Body: { "session_id": "...", "event": "NO_ATTEMPT" }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "error": "Invalid JSON"}), 400

    session_id = data.get("session_id", "")
    event_type = data.get("event", "")

    # Validation
    if not validate_session_id(session_id):
        return jsonify({"success": False, "error": "Invalid session_id"}), 400

    if event_type not in ALLOWED_EVENTS:
        return jsonify({"success": False, "error": "Unknown event type"}), 400

    # Ensure session exists
    session_path = f"sessions/{session_id}"
    if event_type == "PAGE_OPEN":
        write_to_firebase(session_path, {
            "started_at": now_iso(),
            "final_response": None,
            "message": None,
        })

    # Push event
    push_to_firebase(f"{session_path}/events", {
        "type": event_type,
        "timestamp": now_iso(),
    })

    return jsonify({"success": True})


@app.route("/api/response", methods=["POST"])
def api_response():
    """
    Record the final YES/NO response.

    Body: { "session_id": "...", "response": "YES" }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "error": "Invalid JSON"}), 400

    session_id = data.get("session_id", "")
    response = data.get("response", "")

    if not validate_session_id(session_id):
        return jsonify({"success": False, "error": "Invalid session_id"}), 400

    if response not in ALLOWED_RESPONSES:
        return jsonify({"success": False, "error": "Invalid response value"}), 400

    session_path = f"sessions/{session_id}"
    update_firebase(session_path, {
        "final_response": response,
        "responded_at": now_iso(),
    })

    # Also push as an event
    push_to_firebase(f"{session_path}/events", {
        "type": f"{response}_CLICK",
        "timestamp": now_iso(),
    })

    return jsonify({"success": True})


@app.route("/api/message", methods=["POST"])
def api_message():
    """
    Save a personal message from girlfriend.

    Body: { "session_id": "...", "message": "..." }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "error": "Invalid JSON"}), 400

    session_id = data.get("session_id", "")
    message = data.get("message", "")

    if not validate_session_id(session_id):
        return jsonify({"success": False, "error": "Invalid session_id"}), 400

    if not isinstance(message, str):
        return jsonify({"success": False, "error": "Message must be a string"}), 400

    # Trim and enforce length limit
    message = message.strip()
    if len(message) > MAX_MESSAGE_LENGTH:
        message = message[:MAX_MESSAGE_LENGTH]

    if not message:
        return jsonify({"success": False, "error": "Message cannot be empty"}), 400

    session_path = f"sessions/{session_id}"
    update_firebase(session_path, {
        "message": message,
        "message_sent_at": now_iso(),
    })

    push_to_firebase(f"{session_path}/events", {
        "type": "MESSAGE_SENT",
        "timestamp": now_iso(),
    })

    return jsonify({"success": True})


@app.route("/api/health", methods=["GET"])
def api_health():
    """Simple health check endpoint."""
    return jsonify({
        "status": "ok",
        "firebase": firebase_available,
        "timestamp": now_iso(),
    })


# ── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    app.run(host="0.0.0.0", port=5000, debug=debug)
