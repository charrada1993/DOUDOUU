/**
 * Romantic Apology Website – Frontend JavaScript
 *
 * Architecture:
 *  – initializeApp()    Bootstrap everything on DOMContentLoaded
 *  – generateSessionId()  UUID-like session identifier
 *  – trackEvent()       Fire-and-forget API call to Flask backend
 *  – moveNoButton()     Keeps NO button playfully out of reach
 *  – showNoMessage()    Rotating cute messages
 *  – handleNoHover()    Proximity-based dodge on mouse move
 *  – handleNoTouch()    Touch-based dodge on mobile
 *  – handleNoClick()    Called when NO is actually clicked
 *  – handleYes()        YES path – animation + forgiven section
 *  – showForgiveness()  Reveal the forgiven card
 *  – createHeartBurst() Confetti/heart explosion
 *  – createConfetti()   Falling confetti pieces
 *  – submitMessage()    POST girlfriend's optional message
 *  – toggleMusic()      Play/pause background audio
 *  – initParticles()    Ambient star-like particles
 *  – initFloatingHearts()  Continuous rising hearts
 */

"use strict";

/* ── Constants ──────────────────────────────────────────────────────────── */

const NO_MESSAGES = [
  "Are you sure? 🥺",
  "Think about it again...",
  "My heart is currently crying 😭",
  "I'll wait for you ❤️",
  "Maybe give me one more chance?",
  "Okay... I'll keep apologising 🥹",
  "I understand. Take your time ❤️",
  "Please... 🥺",
  "Hobiiiiiiiiiiiiiiii🥺.",
  "HABIBIIIIIIIIII🥺",
  "I miss your smile already.",
  "Every second without your forgiveness hurts.",
  "But I know I hurt you first... I'm so sorry.",
  "I'll be here whenever you're ready.",
];

const CONFETTI_COLOURS = [
  "#ff4f81", "#ff8fab", "#ffd6e5",
  "#ffb347", "#fffacd", "#c8a2c8",
];

/* ── State ──────────────────────────────────────────────────────────────── */

let sessionId = "";
let noAttemptCount = 0;   // how many times she dodged / clicked NO
let messageIndex = 0;   // rotating NO messages
let isMusicPlaying = false;
let noButtonMoving = false;
let yesHandled = false;

/* ── DOM references (populated in initializeApp) ────────────────────────── */

let btnYes, btnNo, noMessageEl, sectionApology, sectionForgiven,
  confettiContainer, bgMusic, musicBtn, textarea, charCount,
  btnSend, messageSent, messageForm;

/* ═══════════════════════════════════════════════════════════════════════════
   1. BOOTSTRAP
   ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", initializeApp);

/**
 * Bootstrap – called once the DOM is ready.
 */
function initializeApp() {
  // Cache DOM
  btnYes          = document.getElementById("btn-yes");
  btnNo           = document.getElementById("btn-no");
  noMessageEl     = document.getElementById("no-message");
  sectionApology  = document.getElementById("section-apology");
  sectionForgiven = document.getElementById("section-forgiven");
  confettiContainer = document.getElementById("confetti-container");
  bgMusic         = null;           // music handled by YouTube IFrame Player
  musicBtn        = document.getElementById("music-btn");
  textarea        = document.getElementById("message-textarea");
  charCount       = document.getElementById("char-count");
  btnSend         = document.getElementById("btn-send");
  messageSent     = document.getElementById("message-sent");
  messageForm     = document.getElementById("message-form");

  // Generate session
  sessionId = generateSessionId();

  // Track page open
  trackEvent("PAGE_OPEN");

  // Visuals
  initParticles();
  initFloatingHearts();

  // Music button
  if (musicBtn) {
    musicBtn.addEventListener("click", toggleMusic);
  }

  // Textarea live counter
  if (textarea) {
    textarea.addEventListener("input", () => {
      const len = textarea.value.length;
      charCount.textContent = len;
      charCount.style.color = len > 450 ? "#ff4f81" : "";
    });
  }

  // Activate landing section
  sectionApology.classList.add("section--active");

  // Position the NO button after the first paint so layout is ready
  requestAnimationFrame(() => {
    requestAnimationFrame(initNoButton);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. SESSION
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Generate a UUID-v4-like session identifier (no library needed).
 */
function generateSessionId() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  arr[6] = (arr[6] & 0x0f) | 0x40; // version 4
  arr[8] = (arr[8] & 0x3f) | 0x80; // variant
  const hex = [...arr].map(b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. API CALLS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Fire-and-forget: track an interaction event.
 * If the backend is unavailable the website keeps working normally.
 */
async function trackEvent(eventType) {
  try {
    await fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, event: eventType }),
    });
  } catch (_) {
    // Silently ignore – Firebase/backend unavailable should not break UX
  }
}

/**
 * Record the final YES or NO response.
 */
async function recordResponse(response) {
  try {
    await fetch("/api/response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, response }),
    });
  } catch (_) { /* silent */ }
}

/**
 * POST her personal message.
 */
async function postMessage(message) {
  const res = await fetch("/api/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  return res.ok;
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. NO BUTTON – PLAYFUL INTERACTION
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Snap the NO button to the placeholder's position on first load,
 * then wire up all its event listeners.
 * The button is position:fixed from the CSS, lives directly in <body>,
 * and is NEVER hidden, disabled, or removed.
 */
function initNoButton() {
  if (!btnNo) return;

  const placeholder = document.getElementById("btn-no-placeholder");

  if (placeholder) {
    // Position NO button exactly over the placeholder to start
    const r = placeholder.getBoundingClientRect();
    btnNo.style.left = `${r.left}px`;
    btnNo.style.top  = `${r.top}px`;
  } else {
    // Fallback: center-bottom of viewport
    btnNo.style.left = `${(window.innerWidth - 150) / 2}px`;
    btnNo.style.top  = `${window.innerHeight * 0.75}px`;
  }
  btnNo.style.width = ""; // Let CSS handle mobile responsive width

  // Show it (starts invisible via CSS until positioned)
  btnNo.style.opacity    = "1";
  btnNo.style.visibility = "visible";
  btnNo.style.display    = "";

  // Wire events (no inline HTML handlers — all here)
  btnNo.addEventListener("mouseenter", handleNoHover);
  btnNo.addEventListener("touchstart", (e) => {
    if (yesHandled) return;
    e.preventDefault();
    handleNoTouch(e);
  }, { passive: false });
  btnNo.addEventListener("click", handleNoClick);

  // Also dodge on mousemove / touchmove when cursor or finger gets close
  document.addEventListener("mousemove", handleMouseProximity);
  document.addEventListener("touchmove", handleTouchProximity, { passive: true });
  document.addEventListener("touchstart", handleTouchProximity, { passive: true });

  // Clamp button on resize / orientation change
  window.addEventListener("resize", clampNoButtonToViewport);
  window.addEventListener("orientationchange", clampNoButtonToViewport);
}

/**
 * Clamp NO button position on mobile resize or screen rotation.
 */
function clampNoButtonToViewport() {
  if (!btnNo || yesHandled) return;
  const r = btnNo.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const btnW = r.width || 150;
  const btnH = r.height || 44;
  const margin = 12;

  let left = parseFloat(btnNo.style.left) || r.left;
  let top  = parseFloat(btnNo.style.top)  || r.top;

  left = Math.max(margin, Math.min(left, vw - btnW - margin));
  top  = Math.max(margin, Math.min(top,  vh - btnH - margin));

  btnNo.style.left = `${left}px`;
  btnNo.style.top  = `${top}px`;
}

/**
 * Dodge if the mouse cursor comes within DODGE_RADIUS pixels of the NO button.
 */
const DODGE_RADIUS = 80;
function handleMouseProximity(e) {
  if (yesHandled || !btnNo || noButtonMoving) return;

  const r  = btnNo.getBoundingClientRect();
  const cx = r.left + r.width  / 2;
  const cy = r.top  + r.height / 2;
  const dx = e.clientX - cx;
  const dy = e.clientY - cy;

  if (Math.sqrt(dx * dx + dy * dy) < DODGE_RADIUS) {
    trackEvent("NO_ATTEMPT");
    noAttemptCount++;
    showNoMessage();
    moveNoButton();
  }
}

/**
 * Touch proximity handler for mobile screens.
 */
function handleTouchProximity(e) {
  if (yesHandled || !btnNo || noButtonMoving) return;
  if (!e.touches || e.touches.length === 0) return;

  const touch = e.touches[0];
  const r  = btnNo.getBoundingClientRect();
  const cx = r.left + r.width  / 2;
  const cy = r.top  + r.height / 2;
  const dx = touch.clientX - cx;
  const dy = touch.clientY - cy;

  const touchRadius = 70;
  if (Math.sqrt(dx * dx + dy * dy) < touchRadius) {
    trackEvent("NO_ATTEMPT");
    noAttemptCount++;
    showNoMessage();
    moveNoButton();
  }
}

/**
 * Move the NO button to a random safe position within the viewport.
 * Button stays VISIBLE and INSIDE the screen at all times.
 */
function moveNoButton() {
  if (!btnNo || noButtonMoving) return;
  noButtonMoving = true;

  const btnR   = btnNo.getBoundingClientRect();
  const btnW   = btnR.width  || 150;
  const btnH   = btnR.height || 44;
  const margin = 12;

  const vw = Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth);
  const vh = Math.min(window.innerHeight, document.documentElement.clientHeight || window.innerHeight);

  const yesRect = btnYes ? btnYes.getBoundingClientRect()
                         : { left: -999, right: -999, top: -999, bottom: -999 };

  let x, y, attempts = 0;
  const maxX = Math.max(margin, vw - btnW - margin);
  const maxY = Math.max(margin, vh - btnH - margin);

  do {
    x = margin + Math.random() * Math.max(1, maxX - margin);
    y = margin + Math.random() * Math.max(1, maxY - margin);
    attempts++;
  } while (
    attempts < 40 &&
    rectsOverlap(
      { left: x, right: x + btnW, top: y, bottom: y + btnH },
      yesRect,
      30
    )
  );

  // Hard clamp — button can never escape the viewport
  x = Math.max(margin, Math.min(x, maxX));
  y = Math.max(margin, Math.min(y, maxY));

  btnNo.style.left      = `${x}px`;
  btnNo.style.top       = `${y}px`;
  btnNo.style.transform = `rotate(${(Math.random() - 0.5) * 12}deg) scale(1.03)`;

  // Ensure it stays fully visible — these must never change
  btnNo.style.opacity    = "1";
  btnNo.style.visibility = "visible";
  btnNo.style.display    = "";
  btnNo.disabled         = false;

  setTimeout(() => { noButtonMoving = false; }, 420);
}

/**
 * Check if two rects overlap with optional padding.
 */
function rectsOverlap(a, b, pad = 0) {
  return !(
    a.right  + pad < b.left   ||
    a.left   - pad > b.right  ||
    a.bottom + pad < b.top    ||
    a.top    - pad > b.bottom
  );
}

/** Mouse enters the NO button — dodge immediately. */
function handleNoHover() {
  if (yesHandled) return;
  trackEvent("NO_ATTEMPT");
  noAttemptCount++;
  showNoMessage();
  moveNoButton();
}

/** Touch starts on the NO button — dodge (mobile). */
function handleNoTouch(e) {
  if (yesHandled) return;
  trackEvent("NO_ATTEMPT");
  noAttemptCount++;
  showNoMessage();
  moveNoButton();
}

/**
 * NO was actually clicked — record it and show a final graceful message.
 * Button stays fully visible.
 */
function handleNoClick() {
  if (yesHandled) return;
  trackEvent("NO_CLICK");
  recordResponse("NO");
  noAttemptCount++;
  // Move away again so it keeps traveling
  moveNoButton();
  // Show graceful message
  const graceful = noAttemptCount > 4
    ? "I understand. I'll be here whenever you're ready. ❤️"
    : null;
  showNoMessage(graceful);
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. NO MESSAGE DISPLAY
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Show a rotating message under the buttons.
 * @param {string|null} overrideMsg – if set, show this instead of rotating list
 */
function showNoMessage(overrideMsg = null) {
  if (!noMessageEl) return;

  const msg = overrideMsg || NO_MESSAGES[messageIndex % NO_MESSAGES.length];
  messageIndex++;

  noMessageEl.classList.remove("visible");

  setTimeout(() => {
    noMessageEl.textContent = msg;
    noMessageEl.classList.add("visible");
  }, 100);

  // Auto-hide after 4 seconds
  clearTimeout(noMessageEl._hideTimer);
  noMessageEl._hideTimer = setTimeout(() => {
    noMessageEl.classList.remove("visible");
  }, 4000);
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. YES HANDLER
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Handle YES click – the happy path!
 */
async function handleYes() {
  if (yesHandled) return;
  yesHandled = true;

  // Disable YES button only — NO button stays in DOM and visible
  // (it becomes irrelevant once the forgiven section shows)
  if (btnYes) {
    btnYes.disabled = true;
    btnYes.style.pointerEvents = "none";
  }
  // Quietly move NO out of the way (don't hide it, just tuck it off-screen edge)
  if (btnNo) {
    btnNo.style.transition    = "opacity 0.5s ease, transform 0.5s ease";
    btnNo.style.opacity       = "0";
    btnNo.style.pointerEvents = "none";
    // Restore after transition so it stays in DOM (not display:none)
    setTimeout(() => { btnNo.style.visibility = "hidden"; }, 600);
  }

  // Record YES
  trackEvent("YES_CLICK");
  await recordResponse("YES");

  // Trigger heart burst from YES button position
  const rect = btnYes
    ? btnYes.getBoundingClientRect()
    : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
  const cx = rect.left + (rect.width  || 0) / 2;
  const cy = rect.top  + (rect.height || 0) / 2;
  createHeartBurst(cx, cy);

  // Short delay then transition to forgiven section
  setTimeout(showForgiveness, 800);
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. FORGIVENESS SECTION
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Transition from apology section to forgiveness section.
 */
function showForgiveness() {
  // Fade out apology
  sectionApology.style.transition = "opacity 0.7s ease";
  sectionApology.style.opacity = "0";

  setTimeout(() => {
    sectionApology.classList.remove("section--active");
    sectionApology.setAttribute("aria-hidden", "true");

    // Fade in forgiven
    sectionForgiven.style.opacity = "0";
    sectionForgiven.classList.add("section--active");
    sectionForgiven.removeAttribute("aria-hidden");

    requestAnimationFrame(() => {
      sectionForgiven.style.transition = "opacity 0.8s ease";
      sectionForgiven.style.opacity = "1";
    });

    // Launch confetti
    createConfetti(80);

    // Delayed second wave
    setTimeout(() => createConfetti(60), 1200);
  }, 700);
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. ANIMATIONS – HEARTS & CONFETTI
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Burst of hearts radiating from a centre point.
 */
function createHeartBurst(cx, cy) {
  const container = confettiContainer;
  if (!container) return;

  const emojis = ["❤️", "💕", "💖", "💗", "💓", "✨"];
  const count = 18;

  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.classList.add("heart-burst");
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];

    const angle = (i / count) * Math.PI * 2;
    const dist = 60 + Math.random() * 100;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist - 40;

    el.style.setProperty("--tx", `${tx}px`);
    el.style.setProperty("--ty", `${ty}px`);
    el.style.setProperty("--burst-dur", `${0.9 + Math.random() * 0.6}s`);
    el.style.setProperty("--burst-delay", `${Math.random() * 0.3}s`);
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
    el.style.fontSize = `${16 + Math.random() * 20}px`;

    container.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }
}

/**
 * Rain confetti pieces from the top of the screen.
 */
function createConfetti(count = 80) {
  if (!confettiContainer) return;

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.classList.add("confetti-piece");

    const colour = CONFETTI_COLOURS[Math.floor(Math.random() * CONFETTI_COLOURS.length)];
    const size = 6 + Math.random() * 10;
    const isHeart = Math.random() > 0.6;

    if (isHeart) {
      el.textContent = "❤️";
      el.style.background = "transparent";
      el.style.fontSize = `${size * 1.8}px`;
      el.style.width = "auto";
      el.style.height = "auto";
    } else {
      el.style.background = colour;
      el.style.width = `${size}px`;
      el.style.height = `${size * (Math.random() > 0.5 ? 1 : 2.5)}px`;
      el.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    }

    el.style.left = `${Math.random() * 100}%`;
    el.style.setProperty("--fall-dur", `${2.5 + Math.random() * 3}s`);
    el.style.setProperty("--fall-delay", `${Math.random() * 2}s`);
    el.style.setProperty("--spin", `${360 + Math.random() * 720}deg`);

    confettiContainer.appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. PERSONAL MESSAGE SUBMISSION
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Submit the girlfriend's optional personal message.
 */
async function submitMessage() {
  if (!textarea || !btnSend) return;

  const msg = textarea.value.trim();
  if (!msg) {
    textarea.focus();
    return;
  }

  btnSend.disabled = true;
  btnSend.textContent = "Sending... 💕";

  try {
    const ok = await postMessage(msg);
    if (ok) {
      trackEvent("MESSAGE_SENT");
    }
  } catch (_) { /* silent – show success anyway */ }

  // Always show success to her regardless of backend status
  if (messageForm) messageForm.style.display = "none";
  if (messageSent) { messageSent.hidden = false; }

  // A small heart burst at the send button location
  if (btnSend) {
    const r = btnSend.getBoundingClientRect();
    createHeartBurst(r.left + r.width / 2, r.top + r.height / 2);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. MUSIC – YouTube IFrame Player
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Toggle background music using the YouTube IFrame Player API.
 *
 * Flow:
 *   1st click → inject the YouTube IFrame API script tag (lazy load)
 *              → onYouTubeIframeAPIReady() (defined in index.html) creates the player
 *              → player.onReady fires → starts playing
 *   2nd click → pause
 *   3rd click → resume
 *
 * The YouTube IFrame is 1x1px, positioned off-screen – only audio is heard.
 */
let ytApiScriptInjected = false;

function toggleMusic() {
  if (!musicBtn) return;

  if (isMusicPlaying) {
    // ── Pause ───────────────────────────────────────────
    if (window.ytPlayer) window.ytPlayer.pauseVideo();
    setMusicUI(false);
    isMusicPlaying = false;

  } else {
    // ── Play ───────────────────────────────────────────
    if (!ytApiScriptInjected) {
      // First click: lazily inject the YouTube IFrame API
      // This satisfies browser autoplay policies (user gesture already happened)
      ytApiScriptInjected = true;
      window.ytPendingPlay = true;  // signal onYouTubeIframeAPIReady to auto-play

      const tag = document.createElement("script");
      tag.src   = "https://www.youtube.com/iframe_api";
      tag.onerror = () => {
        // Network / ad-blocker blocked YouTube – show graceful fallback
        setMusicUI(false);
        const lbl = musicBtn.querySelector(".music-label");
        if (lbl) lbl.textContent = "Song unavailable";
      };
      document.head.appendChild(tag);

    } else if (window.YT_PLAYER_READY && window.ytPlayer) {
      // API already loaded – just resume
      window.ytPlayer.playVideo();
    } else {
      // API injected but player not ready yet – mark pending
      window.ytPendingPlay = true;
    }

    setMusicUI(true);
    isMusicPlaying = true;
  }
}

/**
 * Update the music button visual state.
 * @param {boolean} playing
 */
function setMusicUI(playing) {
  if (!musicBtn) return;
  const lbl = musicBtn.querySelector(".music-label");
  if (playing) {
    musicBtn.classList.add("playing");
    if (lbl) lbl.textContent = "Now playing \uD83C\uDFB5";
  } else {
    musicBtn.classList.remove("playing");
    if (lbl) lbl.textContent = "Play our song";
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   11. AMBIENT PARTICLES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Draw soft glowing star-like particles on a canvas.
 */
function initParticles() {
  const canvas = document.getElementById("particle-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let particles = [];
  let animFrame;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    spawnParticles();
  }

  function spawnParticles() {
    particles = [];
    const count = Math.min(Math.floor((canvas.width * canvas.height) / 14000), 80);
    for (let i = 0; i < count; i++) {
      particles.push(createParticle());
    }
  }

  function createParticle() {
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 0.5 + Math.random() * 2,
      alpha: 0.1 + Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      pulse: Math.random() * Math.PI * 2,
      pSpeed: 0.005 + Math.random() * 0.01,
    };
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.pulse += p.pSpeed;

      // Wrap around edges
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      const glow = Math.sin(p.pulse) * 0.25 + 0.75;
      const alpha = p.alpha * glow;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * glow, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 143, 171, ${alpha})`;
      ctx.fill();
    });

    animFrame = requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  draw();
}

/* ═══════════════════════════════════════════════════════════════════════════
   12. FLOATING HEARTS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Continuously spawn floating heart emoji that rise from the bottom.
 */
function initFloatingHearts() {
  const container = document.getElementById("floating-hearts");
  if (!container) return;

  const emojis = ["❤️", "🩷", "💕", "💖", "💗"];

  function spawnHeart() {
    const el = document.createElement("span");
    el.classList.add("floating-heart");
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];

    const duration = 7 + Math.random() * 8;
    const delay = Math.random() * 4;
    const rotStart = (Math.random() - 0.5) * 30;
    const rotEnd = (Math.random() - 0.5) * 30;

    el.style.left = `${2 + Math.random() * 96}%`;
    el.style.setProperty("--duration", `${duration}s`);
    el.style.setProperty("--delay", `${delay}s`);
    el.style.setProperty("--rot-start", `${rotStart}deg`);
    el.style.setProperty("--rot-end", `${rotEnd}deg`);
    el.style.fontSize = `${14 + Math.random() * 22}px`;
    el.style.opacity = "0";

    container.appendChild(el);

    // Remove after animation completes
    setTimeout(() => el.remove(), (duration + delay + 1) * 1000);
  }

  // Initial batch
  for (let i = 0; i < 12; i++) {
    setTimeout(spawnHeart, Math.random() * 3000);
  }

  // Keep spawning
  setInterval(spawnHeart, 1800);
}
