/* =====================================================================
   HAPPY BIRTHDAY – "Face Scan" prank page
   ---------------------------------------------------------------------
   How it flows:
     1. "Do you trust me?"        (NO disappears after the first try)
     1b. fake "access granted"    (progress bar + small log)
     1c. "the system is stronger" (the mask shows up)
     2. "Can I use your camera?"  (it's a joke – the camera is NEVER used)
     3. fake face scan            (dots -> mesh -> 99% match)
     4. identity card             (then MISMATCH)
     5. the "hack"                (falling code, static, mask)
     6. Happy Birthday!           (block letters, cake, music, message)

   All the texts, the name and the phone number live in the CONFIG
   block at the bottom of index.html – no need to touch this file.
   Every sound is generated live in the browser, there are no audio files.
   ===================================================================== */

(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);

  /* ---------------- settings (from the CONFIG block in index.html) ---------------- */
  const DEFAULTS = {
    name: "UNKNOWN",
    question: "Hello, Do You Trust Me?",
    sadNo: "So I'm Zalan Now",
    accessYes: "Thank you, I got access to your phone ;)",
    stronger: "This time is not like before... the system is stronger.",
    camera: "Can I Use Your Camera?",
    sadCam: "So You Don't Trust Me",
    wish: "",
    wish2: "",
    callText: "Call me",
    phone: "",
    hideNoAfterOne: true,
    maskImage: "",
    maskStyle: "text",
  };
  let raw = {};
  try {
    raw = JSON.parse($("config").textContent) || {};
  } catch (e) {
    raw = {};
  }
  const C = {};
  Object.keys(DEFAULTS).forEach((k) => {
    const d = DEFAULTS[k],
      v = raw[k];
    C[k] = typeof v === typeof d ? v : d;
  });
  C.phone = String(C.phone)
    .replace(/[^\d+]/g, "")
    .slice(0, 20);

  /* every timer belongs to one "run"; replay cancels everything still pending */
  let RUN = 0;

  // Run fn after ms milliseconds, but only if the user hasn't hit "run it again" meanwhile.
  function later(fn, ms) {
    const id = RUN;
    return setTimeout(() => {
      if (id === RUN) fn();
    }, ms);
  }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- audio (generated in the browser, no files) ---------------- */
  let actx = null,
    master = null,
    muted = false;

  // Create the audio engine once (browsers only allow this after the first tap/click).
  function aInit() {
    if (actx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = new AC();
    const comp = actx.createDynamicsCompressor();
    master = actx.createGain();
    master.gain.value = 0.5;
    master.connect(comp);
    comp.connect(actx.destination);
  }

  // Wake the audio engine up if the browser paused it.
  function resume() {
    aInit();
    if (actx && actx.state === "suspended") actx.resume();
  }

  /* Play one synth note.
     f = frequency (Hz), at = start time, dur = length in seconds,
     type = wave shape, vol = loudness, glide = optional pitch to slide to. */
  function tone(f, at, dur, type, vol, glide) {
    if (!actx || muted) return;
    const o = actx.createOscillator(),
      g = actx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f, at);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol || 0.1, at + 0.008);
    g.gain.setValueAtTime(vol || 0.1, at + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(master);
    o.start(at);
    o.stop(at + dur + 0.05);
  }
  let nbuf = null;

  // Play a short burst of filtered white noise (used for static, clicks and booms).
  function noise(at, dur, vol, ftype, freq) {
    if (!actx || muted) return;
    if (!nbuf) {
      nbuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
      const d = nbuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = actx.createBufferSource(),
      f = actx.createBiquadFilter(),
      g = actx.createGain();
    s.buffer = nbuf;
    s.loop = true;
    f.type = ftype || "bandpass";
    f.frequency.value = freq || 1500;
    g.gain.setValueAtTime(vol || 0.1, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f);
    f.connect(g);
    g.connect(master);
    s.start(at);
    s.stop(at + dur + 0.02);
  }

  // Little sound effects, picked by name.
  function sfx(k) {
    if (!actx || muted) return;
    const t = actx.currentTime;
    if (k === "key") tone(1500 + Math.random() * 300, t, 0.025, "square", 0.025);
    if (k === "click") tone(1200, t, 0.06, "square", 0.06);
    if (k === "ok") {
      [660, 880, 1320].forEach((f, i) => tone(f, t + i * 0.07, 0.12, "square", 0.06));
    }
    if (k === "deny") {
      tone(180, t, 0.45, "sawtooth", 0.12);
      tone(120, t + 0.1, 0.6, "sawtooth", 0.1);
    }
    if (k === "alarm") {
      [0, 0.25, 0.5].forEach((d) => {
        tone(960, t + d, 0.12, "square", 0.07);
        tone(640, t + d + 0.12, 0.12, "square", 0.07);
      });
    }
    if (k === "point") tone(2000 + Math.random() * 800, t, 0.03, "sine", 0.04);
    if (k === "line") tone(400 + Math.random() * 400, t, 0.05, "triangle", 0.03);
    if (k === "lock") {
      tone(880, t, 0.12, "square", 0.07);
      tone(1760, t + 0.12, 0.4, "square", 0.07);
    }
    if (k === "glitch") {
      for (let i = 0; i < 14; i++)
        tone(60 + Math.random() * 1500, t + i * 0.035, 0.03, "square", 0.05);
      noise(t, 0.5, 0.14, "highpass", 2500);
    }
    if (k === "boom") {
      tone(110, t, 1.2, "sine", 0.5, 30);
      noise(t, 0.8, 0.25, "lowpass", 400);
    }
    if (k === "static") noise(t, 0.25, 0.08, "highpass", 4000);
  }
  /* low hum while scanning */
  let hum = null;

  // Start the low electric hum that plays under the face scan.
  function humOn() {
    if (!actx || muted || hum) return;
    const o = actx.createOscillator(),
      o2 = actx.createOscillator(),
      g = actx.createGain();
    o.type = "sawtooth";
    o.frequency.value = 55;
    o2.type = "sine";
    o2.frequency.value = 110.6;
    const f = actx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 300;
    g.gain.value = 0.0001;
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(master);
    o.start();
    o2.start();
    g.gain.exponentialRampToValueAtTime(0.12, actx.currentTime + 0.8);
    hum = { o, o2, g };
  }

  // Fade the hum out and stop it.
  function humOff() {
    if (!hum || !actx) return;
    const h = hum,
      t = actx.currentTime;
    hum = null;
    h.g.gain.cancelScheduledValues(t);
    h.g.gain.setValueAtTime(Math.max(h.g.gain.value, 0.0001), t);
    h.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    h.o.stop(t + 0.35);
    h.o2.stop(t + 0.35);
  }
  /* Happy Birthday — public-domain melody, synth arrangement */
  const BPM = 118,
    B = 60 / BPM;
  const P = {
    C4: 261.63,
    D4: 293.66,
    E4: 329.63,
    F4: 349.23,
    G4: 392.0,
    A4: 440.0,
    Bb4: 466.16,
    C5: 523.25,
  };
  const MELODY = [
    [P.C4, 0.5],
    [P.C4, 0.5],
    [P.D4, 1],
    [P.C4, 1],
    [P.F4, 1],
    [P.E4, 2],
    [P.C4, 0.5],
    [P.C4, 0.5],
    [P.D4, 1],
    [P.C4, 1],
    [P.G4, 1],
    [P.F4, 2],
    [P.C4, 0.5],
    [P.C4, 0.5],
    [P.C5, 1],
    [P.A4, 1],
    [P.F4, 1],
    [P.E4, 1],
    [P.D4, 2],
    [P.Bb4, 0.5],
    [P.Bb4, 0.5],
    [P.A4, 1],
    [P.F4, 1],
    [P.G4, 1],
    [P.F4, 3],
  ];

  const BASS = [
    [P.F4 / 2, 0, 3],
    [P.C4 / 2, 6, 3],
    [P.F4 / 2, 12, 3],
    [P.Bb4 / 2, 19, 3],
    [P.C4 / 2, 22, 2],
  ];

  const LOOP = MELODY.reduce((a, x) => a + x[1], 0) + 2;

  let musicOn = false,
    musicTimer = null;

  // Schedule one full round of Happy Birthday, then queue the next round.
  function playSong() {
    if (!actx) return;
    const t0 = actx.currentTime + 0.1;
    let t = t0;
    MELODY.forEach(([f, b]) => {
      tone(f * 2, t, b * B * 0.85, "square", 0.07);
      tone(f * 4, t, 0.12, "sine", 0.04);
      t += b * B;
    });
    BASS.forEach(([f, beat, b]) => tone(f, t0 + beat * B, b * B * 0.9, "triangle", 0.16));
    for (let i = 0; i < LOOP; i++) noise(t0 + i * B, 0.05, 0.05, "highpass", 6000);
    musicTimer = setTimeout(
      () => {
        if (musicOn) playSong();
      },
      LOOP * B * 1000,
    );
  }

  // Start the birthday music on a loop.
  function songOn() {
    resume();
    clearTimeout(musicTimer);
    musicOn = true;
    if (!muted) playSong();
  }

  // Stop the birthday music.
  function songOff() {
    musicOn = false;
    clearTimeout(musicTimer);
  }

  /* ---------------- helpers ---------------- */
  /* Typewriter effect: reveal `text` inside `el` one letter at a time,
     then call `done` when finished. */
  function type(el, text, speed, done) {
    const id = RUN,
      ch = Array.from(text);
    let i = 0;
    el.textContent = "";
    (function step() {
      if (id !== RUN) return;
      if (i <= ch.length) {
        el.textContent = ch.slice(0, i).join("");
        if (i > 0 && ch[i - 1] !== " " && i % 2) sfx("key");
        i++;
        setTimeout(step, speed);
      } else if (done) done();
    })();
  }
  const SCREENS = ["s-q1", "s-access", "s-strong", "s-q2", "s-scan", "s-id", "s-hack", "s-party"];

  // Show one screen and hide all the others.
  function show(id) {
    SCREENS.forEach((s) => $(s).classList.toggle("hidden", s !== id));
    $(id).scrollTop = 0;
  }

  // Switch the top bar between the calm green state and the red "intrusion" state.
  function alarm(on) {
    document.body.classList.toggle("alarm", on);
    $("tbState").textContent = on ? "INTRUSION DETECTED" : "SECURE NODE";
  }
  /* ---------------- the hooded figure, drawn out of moving text ---------------- */
  const MASK_TEXT = "WE ARE ANONYMOUS. WE ARE WATCHING. EXPECT US. ";
  let masks = [],
    maskRaf = null,
    maskLast = 0;

  /* Build the shapes for the hooded figure (hood outline, face hole, eyes),
     scaled to a canvas of w x h pixels. */
  function maskGeo(w, h) {
    const cx = w / 2,
      cy = h * 0.5,
      sx = w * 0.48,
      sy = h * 0.47;
    const X = (x) => cx + x * sx,
      Y = (y) => cy + y * sy;
    const hood = new Path2D();
    hood.moveTo(X(0), Y(-1));
    hood.bezierCurveTo(X(0.3), Y(-0.98), X(0.55), Y(-0.8), X(0.55), Y(-0.45));
    hood.bezierCurveTo(X(0.58), Y(-0.15), X(0.66), Y(0.05), X(0.62), Y(0.25));
    hood.bezierCurveTo(X(0.75), Y(0.45), X(0.98), Y(0.6), X(1), Y(0.95));
    hood.lineTo(X(1), Y(1));
    hood.lineTo(X(-1), Y(1));
    hood.lineTo(X(-1), Y(0.95));
    hood.bezierCurveTo(X(-0.98), Y(0.6), X(-0.75), Y(0.45), X(-0.62), Y(0.25));
    hood.bezierCurveTo(X(-0.66), Y(0.05), X(-0.58), Y(-0.15), X(-0.55), Y(-0.45));
    hood.bezierCurveTo(X(-0.55), Y(-0.8), X(-0.3), Y(-0.98), X(0), Y(-1));
    hood.closePath();
    const face = new Path2D();
    face.moveTo(X(0), Y(-0.72));
    face.bezierCurveTo(X(0.22), Y(-0.7), X(0.38), Y(-0.42), X(0.36), Y(-0.15));
    face.bezierCurveTo(X(0.34), Y(0.18), X(0.18), Y(0.4), X(0), Y(0.42));
    face.bezierCurveTo(X(-0.18), Y(0.4), X(-0.34), Y(0.18), X(-0.36), Y(-0.15));
    face.bezierCurveTo(X(-0.38), Y(-0.42), X(-0.22), Y(-0.7), X(0), Y(-0.72));
    face.closePath();
    const poly = (pts) => {
      const q = new Path2D();
      pts.forEach(([x, y], i) => (i ? q.lineTo(X(x), Y(y)) : q.moveTo(X(x), Y(y))));
      q.closePath();
      return q;
    };
    return {
      hood,
      face,
      X,
      Y,
      eyes: [
        poly([
          [-0.27, -0.2],
          [-0.06, -0.12],
          [-0.08, -0.08],
          [-0.25, -0.13],
        ]),
        poly([
          [0.27, -0.2],
          [0.06, -0.12],
          [0.08, -0.08],
          [0.25, -0.13],
        ]),
      ],
    };
  }
  /* optional picture from the CONFIG block ("maskImage"): a file in this folder only */
  let maskPic = null;
  (function loadMaskPic() {
    const name = String(C.maskImage || "").trim();
    if (!name) return;
    if (!/^[\w\- ]+(\/[\w\- ]+)*\.(png|jpe?g|webp|gif)$/i.test(name)) return; // no web links, no "../"
    const im = new Image();
    im.onload = () => {
      const s = Math.min(1, 700 / Math.max(im.naturalWidth, im.naturalHeight));
      const w = Math.max(1, Math.round(im.naturalWidth * s)),
        h = Math.max(1, Math.round(im.naturalHeight * s));
      let stencil = null;
      if (C.maskStyle !== "image") {
        try {
          /* turn the picture into a stencil: bright parts let the text through, dark parts hide it */
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          const x = c.getContext("2d");
          x.drawImage(im, 0, 0, w, h);
          const d = x.getImageData(0, 0, w, h),
            p = d.data;
          for (let i = 0; i < p.length; i += 4) {
            const lum = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) / 255;
            p[i] = p[i + 1] = p[i + 2] = 255;
            p[i + 3] = Math.round(p[i + 3] * Math.min(1, lum * 1.25));
          }
          x.putImageData(d, 0, 0);
          stencil = c;
        } catch (e) {
          stencil = null;
        } // e.g. opened straight from disk: fall back to the plain picture
      }
      maskPic = { im, w, h, stencil };
      masks.forEach((m) => (m.geo = null)); // re-measure with the picture's proportions
    };
    im.src = name;
  })();

  // Fit a mask canvas to its box. Returns false if the box isn't visible yet.
  function sizeMask(m) {
    const w = (m.cv.parentNode && m.cv.parentNode.clientWidth) || 0;
    if (!w) return false;
    const ratio = maskPic ? Math.min(1.5, Math.max(0.8, maskPic.h / maskPic.w)) : 1.22;
    const h = Math.round(w * ratio),
      d = Math.min(devicePixelRatio || 1, 2);
    m.cv.width = w * d;
    m.cv.height = h * d;
    m.cv.style.height = h + "px";
    m.x = m.cv.getContext("2d");
    m.x.setTransform(d, 0, 0, d, 0, 0);
    m.w = w;
    m.h = h;
    m.d = d;
    m.geo = maskGeo(w, h);
    return true;
  }

  /* Fill the canvas with rows of the slogan text. Odd and even rows
     slide in opposite directions so the text looks alive. */
  function textRows(x, w, h, t, fs) {
    const lh = fs * 1.1,
      lw = x.measureText(MASK_TEXT).width;
    for (let y = -lh, row = 0; y < h; y += lh, row++) {
      const off = (t * 16 * (row % 2 ? 1 : -1) + row * 41) % lw;
      for (let xx = (((off % lw) + lw) % lw) - lw; xx < w; xx += lw) x.fillText(MASK_TEXT, xx, y);
    }
  }

  /* Draw the custom PNG (from "maskImage" in the config) – either built
     out of the moving text, or just tinted green. */
  function drawPic(m) {
    const x = m.x,
      w = m.w,
      h = m.h,
      P = maskPic;
    const s = Math.min(w / P.w, h / P.h),
      dw = P.w * s,
      dh = P.h * s,
      dx = (w - dw) / 2,
      dy = (h - dh) / 2;
    x.clearRect(0, 0, w, h);
    if (P.stencil) {
      const fs = Math.max(6, w / 29);
      x.font = "700 " + fs + "px 'JetBrains Mono', monospace";
      x.textBaseline = "top";
      const g = x.createRadialGradient(w * 0.38, h * 0.25, w * 0.04, w * 0.5, h * 0.45, w * 0.7);
      g.addColorStop(0, "#eaffea");
      g.addColorStop(0.3, "#8dff9b");
      g.addColorStop(0.62, "#22b32d");
      g.addColorStop(1, "#0a3a10");
      x.fillStyle = g;
      textRows(x, w, h, m.t, fs);
      x.globalCompositeOperation = "destination-in";
      x.drawImage(P.stencil, dx, dy, dw, dh);
      x.globalCompositeOperation = "source-over";
    } else {
      x.drawImage(P.im, dx, dy, dw, dh);
      x.globalCompositeOperation = "source-atop";
      x.fillStyle = "rgba(43,217,74,.45)";
      x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = "source-over";
    }
  }

  // Draw one frame of the hooded figure (or the custom PNG if there is one).
  function drawMask(m) {
    if (maskPic) {
      drawPic(m);
      glitchBurst(m);
      return;
    }
    const x = m.x,
      w = m.w,
      h = m.h,
      G = m.geo,
      X = G.X,
      Y = G.Y;
    x.clearRect(0, 0, w, h);
    const fs = Math.max(6, w / 29);
    x.font = "700 " + fs + "px 'JetBrains Mono', monospace";
    x.textBaseline = "top";

    /* the hood (cloth made of text) */
    x.save();
    x.clip(G.hood);
    const g = x.createRadialGradient(w * 0.36, h * 0.18, w * 0.04, w * 0.5, h * 0.45, w * 0.7);
    g.addColorStop(0, "#eaffea");
    g.addColorStop(0.3, "#8dff9b");
    g.addColorStop(0.62, "#22b32d");
    g.addColorStop(1, "#0a3a10");
    x.fillStyle = g;
    textRows(x, w, h, m.t, fs);
    x.globalCompositeOperation = "source-atop";
    const v = x.createLinearGradient(0, h * 0.55, 0, h);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.75)");
    x.fillStyle = v;
    x.fillRect(0, 0, w, h);
    x.strokeStyle = "rgba(0,0,0,.55)";
    x.lineCap = "round";
    x.lineWidth = w * 0.03;
    x.beginPath();
    x.moveTo(X(-0.42), Y(-0.6));
    x.quadraticCurveTo(X(-0.5), Y(0), X(-0.42), Y(0.45));
    x.moveTo(X(0.42), Y(-0.6));
    x.quadraticCurveTo(X(0.5), Y(0), X(0.42), Y(0.45));
    x.moveTo(X(-0.6), Y(0.4));
    x.quadraticCurveTo(X(-0.55), Y(0.7), X(-0.68), Y(1));
    x.moveTo(X(0.6), Y(0.4));
    x.quadraticCurveTo(X(0.55), Y(0.7), X(0.68), Y(1));
    x.moveTo(X(0), Y(0.5));
    x.lineTo(X(0), Y(1));
    x.stroke();
    x.restore();

    /* the empty face: darkness with a faint echo of the text */
    const shade = x.createRadialGradient(X(0), Y(-0.1), 0, X(0), Y(-0.1), w * 0.3);
    shade.addColorStop(0, "#000");
    shade.addColorStop(0.75, "#010401");
    shade.addColorStop(1, "#06200a");
    x.fillStyle = shade;
    x.fill(G.face);
    x.save();
    x.clip(G.face);
    x.fillStyle = "rgba(43,217,74,.06)";
    textRows(x, w, h, -m.t, fs);
    x.restore();
    x.save();
    x.shadowColor = "rgba(0,0,0,.9)";
    x.shadowBlur = 18;
    x.strokeStyle = "rgba(0,0,0,.9)";
    x.lineWidth = 6;
    x.stroke(G.face);
    x.restore();

    /* glowing eyes that blink now and then */
    const blink = m.t % 4.3 < 0.14;
    if (!blink) {
      const a = 0.7 + 0.3 * Math.sin(m.t * 2.2);
      x.save();
      x.shadowColor = "#ff2b4a";
      x.shadowBlur = 18;
      x.fillStyle = "rgba(255,43,74," + a + ")";
      G.eyes.forEach((e) => x.fill(e));
      x.shadowBlur = 0;
      x.fillStyle = "rgba(255,210,215," + a * 0.8 + ")";
      [
        [-0.16, -0.135],
        [0.16, -0.135],
      ].forEach(([ex, ey]) => {
        x.beginPath();
        x.arc(X(ex), Y(ey), Math.max(1.2, w * 0.007), 0, 6.29);
        x.fill();
      });
      x.restore();
    }
    x.strokeStyle = "rgba(43,217,74,.28)";
    x.lineWidth = 1;
    x.stroke(G.hood);

    glitchBurst(m);
  }
  /* now and then the figure breaks apart into code for a moment */
  // Now and then, tear the figure into strips and sprinkle some 1s and 0s on it.
  function glitchBurst(m) {
    const x = m.x,
      w = m.w,
      h = m.h;
    if (m.burst > 0) {
      const d = m.d;
      for (let i = 0; i < 7; i++) {
        const sy = Math.random() * h,
          sh = 4 + Math.random() * 22,
          dx = (Math.random() - 0.5) * w * 0.25;
        x.drawImage(m.cv, 0, sy * d, w * d, sh * d, dx, sy, w, sh);
      }
      x.fillStyle = "rgba(43,217,74,.5)";
      for (let i = 0; i < 10; i++)
        x.fillText("01"[(Math.random() * 2) | 0], Math.random() * w, Math.random() * h);
    }
  }

  // Animation loop for every mask on the page (about 15 frames a second).
  function maskLoop(now) {
    masks = masks.filter((m) => m.cv.isConnected);
    if (!masks.length) {
      maskRaf = null;
      return;
    }
    if (now - maskLast > 60) {
      const dt = Math.min(0.2, (now - maskLast) / 1000);
      maskLast = now;
      masks.forEach((m) => {
        if (m.cv.offsetParent === null) return;
        if (!m.geo || m.w !== m.cv.parentNode.clientWidth) {
          if (!sizeMask(m)) return;
        }
        m.t += dt;
        m.burst = (m.burst || 0) - dt;
        if (m.burst <= 0 && Math.random() < dt * 0.35) m.burst = 0.35 + Math.random() * 0.3;
        drawMask(m);
      });
    }
    maskRaf = requestAnimationFrame(maskLoop);
  }

  // Put a new animated mask canvas inside `box`.
  function putMask(box) {
    const cv = document.createElement("canvas");
    cv.className = "mask-cv";
    box.replaceChildren(cv);
    masks.push({ cv, t: Math.random() * 10 });
    if (!maskRaf) {
      maskLast = performance.now();
      maskRaf = requestAnimationFrame(maskLoop);
    }
  }
  const pad = (n) => String(n).padStart(2, "0");

  /* clock in the top bar */
  setInterval(() => {
    const d = new Date();
    $("tbClock").textContent =
      pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }, 1000);

  /* modal */
  let alertDone = null;

  // Show the red error box. `done` runs when the user taps the button.
  function popup(title, msg, done) {
    $("alertTitle").textContent = title;
    $("alertMsg").textContent = msg;
    alertDone = done || null;
    $("veil").classList.add("show");
    $("alertBtn").focus();
    sfx("deny");
  }
  $("alertBtn").addEventListener("click", () => {
    $("veil").classList.remove("show");
    sfx("click");
    const f = alertDone;
    alertDone = null;
    if (f) f();
  });
  /* the NO button glitches away after the first NO */
  // After the first NO, make the NO button glitch away so only YES is left.
  function dropNo(btn) {
    if (!C.hideNoAfterOne) return;
    btn.classList.add("gone");
    const sep = btn.parentNode.querySelector(".sep");
    later(() => {
      btn.classList.add("hidden");
      if (sep) sep.classList.add("hidden");
    }, 520);
  }

  /* ---------------- ambient background ---------------- */
  const bg = $("bg"),
    bx = bg.getContext("2d");
  let bgCols = [],
    bgLast = 0;

  // Resize the background canvas and reset the falling characters.
  function sizeBg() {
    const d = Math.min(devicePixelRatio || 1, 2);
    bg.width = innerWidth * d;
    bg.height = innerHeight * d;
    bx.setTransform(d, 0, 0, d, 0, 0);
    bgCols = Array.from({ length: Math.ceil(innerWidth / 22) }, () => Math.random() * innerHeight);
  }

  // Slow falling hex characters in the background.
  function bgLoop(t) {
    if (t - bgLast > 90) {
      bgLast = t;
      bx.fillStyle = "rgba(2,7,10,.25)";
      bx.fillRect(0, 0, innerWidth, innerHeight);
      bx.font = "12px 'JetBrains Mono', monospace";
      bgCols.forEach((y, i) => {
        if (Math.random() < 0.5) {
          bx.fillStyle = Math.random() < 0.05 ? "rgba(43,217,74,.6)" : "rgba(43,217,74,.12)";
          bx.fillText("0123456789ABCDEF"[(Math.random() * 16) | 0], i * 22, y);
        }
        bgCols[i] = y > innerHeight ? 0 : y + 14;
      });
    }
    requestAnimationFrame(bgLoop);
  }
  sizeBg();
  if (!reduce) requestAnimationFrame(bgLoop);

  /* ---------------- 1. trust ---------------- */
  // Screen 1: "Do you trust me?"
  function step1() {
    alarm(false);
    show("s-q1");
    const b = $("b1");
    b.classList.remove("show");
    type($("q1"), C.question, 60, () => later(() => b.classList.add("show"), 250));
  }
  $("no1").addEventListener("click", () => {
    resume();
    popup("REJECTED", C.sadNo, () => dropNo($("no1")));
  });
  $("yes1").addEventListener("click", () => {
    resume();
    sfx("ok");
    access();
  });

  /* ---------------- 1b. access ---------------- */
  // Screen 1b: fake "access granted" with a progress bar and a small log.
  function access() {
    show("s-access");
    const fill = $("accFill"),
      label = $("accLabel"),
      log = $("accLog");
    fill.style.width = "0%";
    log.replaceChildren();
    label.textContent = "LINKING DEVICE… 0%";
    type($("accessMsg"), C.accessYes, 45, () => {
      const LINES = [
        ["> handshake ............ ", "OK"],
        ["> device ............... ", "LINKED"],
        ["> contacts ............. ", "SYNCED"],
        ["> gallery .............. ", "INDEXED"],
      ];
      let p = 0;
      const tick = () => {
        p = Math.min(100, p + 3 + Math.random() * 5);
        fill.style.width = p + "%";
        label.textContent = "LINKING DEVICE… " + Math.round(p) + "%";
        const shown = Math.floor(p / 25);
        while (log.children.length < Math.min(shown, LINES.length)) {
          const [a, b] = LINES[log.children.length];
          const row = document.createElement("div"),
            ok = document.createElement("span");
          ok.className = "ok";
          ok.textContent = b;
          row.append(a, ok);
          log.append(row);
          sfx("click");
        }
        if (p < 100) later(tick, 90);
        else later(stronger, 900);
      };
      later(tick, 400);
    });
  }

  /* ---------------- 1c. stronger ---------------- */
  // Screen 1c: the red warning text, then the mask appears.
  function stronger() {
    show("s-strong");
    alarm(true);
    sfx("alarm");
    const box = $("maskBox1");
    box.classList.add("hidden");
    box.replaceChildren();
    later(
      () =>
        type($("strongMsg"), C.stronger, 55, () => {
          later(() => {
            box.classList.remove("hidden");
            putMask(box);
            sfx("glitch");
            sfx("boom");
          }, 500);
          later(step2, 3400);
        }),
      600,
    );
  }

  /* ---------------- 2. camera ---------------- */
  // Screen 2: "Can I use your camera?" (nothing ever turns the camera on).
  function step2() {
    alarm(false);
    show("s-q2");
    const b = $("b2");
    b.classList.remove("show");
    type($("q2"), C.camera, 60, () => later(() => b.classList.add("show"), 250));
  }
  $("no2").addEventListener("click", () => {
    popup("ACCESS DENIED", C.sadCam, () => dropNo($("no2")));
  });
  $("yes2").addEventListener("click", () => {
    sfx("ok");
    scan();
  });

  /* ---------------- 3. face scan (animation only — the camera is never used) ---------------- */
  const fc = $("face"),
    fx = fc.getContext("2d");
  /* face points traced from a typical face, in a -1..1 box (x right, y down) */
  const P_ = (x, y) => [(x - 510) / 200, (y - 280) / 200];
  const OUTLINE = [
    [510, 12],
    [580, 20],
    [655, 60],
    [690, 130],
    [705, 205],
    [700, 290],
    [690, 370],
    [670, 440],
    [630, 490],
    [575, 525],
    [510, 545],
    [445, 525],
    [390, 490],
    [350, 440],
    [330, 370],
    [318, 290],
    [312, 205],
    [328, 130],
    [362, 60],
    [435, 20],
  ].map((p) => P_(p[0], p[1]));
  const FACE = (() => {
    const pts = [];
    const add = (x, y, g, mark) => {
      const [nx, ny] = P_(x, y);
      pts.push({ x: nx, y: ny, g: g || "", mark: !!mark });
      return pts.length - 1;
    };
    OUTLINE.forEach(([x, y]) => pts.push({ x, y, g: "", mark: false }));
    [
      [400, 110, 1],
      [510, 98, 1],
      [618, 110, 1],
      [455, 62],
      [565, 62],
      [350, 170],
      [670, 170],
      [455, 135],
      [565, 135],
    ].forEach((p) => add(p[0], p[1], "", p[2]));
    [
      [483, 152],
      [497, 147],
      [510, 146],
      [523, 147],
      [537, 152],
    ].forEach((p) => add(p[0], p[1], "", true)); // dots above the nose
    [
      [418, 208],
      [602, 208],
    ].forEach(([cx, cy], k) => {
      // eye rings
      const g = k ? "eyeR" : "eyeL",
        dir = k ? 1 : -1;
      add(cx + dir * 66, cy + 4, g, true);
      add(cx - dir * 70, cy + 4, g, true);
      add(cx, cy - 26, g);
      add(cx + 34, cy - 20, g);
      add(cx - 34, cy - 20, g);
      add(cx, cy + 25, g, true);
      add(cx + 34, cy + 20, g);
      add(cx - 34, cy + 20, g);
    });
    [
      [380, 265, 1],
      [640, 265, 1],
      [360, 305],
      [660, 305],
      [392, 340, 1],
      [628, 340, 1],
      [450, 285],
      [570, 285],
      [430, 345],
      [590, 345],
      [340, 250],
      [680, 250],
      [400, 420],
      [620, 420],
      [420, 470],
      [600, 470],
      [455, 385, 1],
      [565, 385, 1],
    ].forEach((p) => add(p[0], p[1], "", p[2]));
    [
      [510, 180, 1],
      [510, 215, 1],
      [496, 245, 1],
      [524, 245, 1],
      [510, 290, 1],
      [486, 268],
      [534, 268],
      [470, 322, 1],
      [550, 322, 1],
      [486, 346, 1],
      [534, 346, 1],
      [510, 326, 1],
      [510, 350, 1],
    ].forEach((p) => add(p[0], p[1], "nose", p[2]));
    [
      [420, 428],
      [598, 428],
      [465, 411],
      [510, 402],
      [555, 411],
      [465, 452],
      [510, 462],
      [555, 452],
    ].forEach((p, i) => add(p[0], p[1], "mouth", i < 2 || i === 3 || i === 6));
    [
      [510, 385, 1],
      [465, 490, 1],
      [510, 522, 1],
      [555, 490, 1],
      [510, 492],
    ].forEach((p) => add(p[0], p[1], "", p[2]));
    /* depth: rounder in the middle, nose sticks out */
    pts.forEach((p) => {
      p.z =
        0.55 * (1 - Math.min(1, p.x * p.x)) +
        (p.g === "nose" ? 0.25 : 0) +
        (p.g.startsWith("eye") ? -0.06 : 0);
    });
    return pts;
  })();
  /* triangulate (Bowyer–Watson) and keep the triangles that sit on the face */
  const EDGES = (() => {
    const P = FACE.map((p) => [p.x, p.y]);
    const big = 20,
      st = [
        [-big, -big],
        [big * 2, -big],
        [-big, big * 2],
      ];
    const all = P.concat(st),
      n = P.length;
    const circ = (a, b, c) => {
      const [ax, ay] = all[a],
        [bx, by] = all[b],
        [cx, cy] = all[c];
      const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
      const ux =
        ((ax * ax + ay * ay) * (by - cy) +
          (bx * bx + by * by) * (cy - ay) +
          (cx * cx + cy * cy) * (ay - by)) /
        d;
      const uy =
        ((ax * ax + ay * ay) * (cx - bx) +
          (bx * bx + by * by) * (ax - cx) +
          (cx * cx + cy * cy) * (bx - ax)) /
        d;
      return [ux, uy, (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy)];
    };
    let tris = [[n, n + 1, n + 2]].map((t) => ({ v: t, c: circ(...t) }));
    for (let i = 0; i < n; i++) {
      const [px, py] = all[i],
        bad = [],
        keep = [];
      tris.forEach((t) => ((px - t.c[0]) ** 2 + (py - t.c[1]) ** 2 < t.c[2] ? bad : keep).push(t));
      const cnt = new Map();
      bad.forEach((t) =>
        [
          [0, 1],
          [1, 2],
          [2, 0],
        ].forEach(([u, v]) => {
          const a = t.v[u],
            b = t.v[v],
            k = a < b ? a + "-" + b : b + "-" + a;
          cnt.set(k, (cnt.get(k) || 0) + 1);
        }),
      );
      tris = keep;
      cnt.forEach((c, k) => {
        if (c === 1) {
          const [a, b] = k.split("-").map(Number);
          tris.push({ v: [a, b, i], c: circ(a, b, i) });
        }
      });
    }
    const inside = (x, y) => {
      let r = false;
      for (let i = 0, k = OUTLINE.length - 1; i < OUTLINE.length; k = i++) {
        const [xi, yi] = OUTLINE[i],
          [xk, yk] = OUTLINE[k];
        if (yi > y !== yk > y && x < ((xk - xi) * (y - yi)) / (yk - yi) + xi) r = !r;
      }
      return r;
    };
    const e = new Map();
    tris.forEach((t) => {
      if (t.v.some((v) => v >= n)) return;
      const cx = (P[t.v[0]][0] + P[t.v[1]][0] + P[t.v[2]][0]) / 3,
        cy = (P[t.v[0]][1] + P[t.v[1]][1] + P[t.v[2]][1]) / 3;
      if (!inside(cx, cy)) return;
      const g = FACE[t.v[0]].g;
      if ((g === "eyeL" || g === "eyeR" || g === "mouth") && t.v.every((v) => FACE[v].g === g))
        return; // keep eyes and lips open
      [
        [0, 1],
        [1, 2],
        [2, 0],
      ].forEach(([u, v]) => {
        const a = t.v[u],
          b = t.v[v];
        e.set(a < b ? a + "-" + b : b + "-" + a, [a, b]);
      });
    });
    for (let i = 0; i < OUTLINE.length; i++) {
      const b = (i + 1) % OUTLINE.length;
      e.set(i < b ? i + "-" + b : b + "-" + i, [i, b]);
    }
    return Array.from(e.values()).sort(
      (p, q) => P[p[0]][1] + P[p[1]][1] - (P[q[0]][1] + P[q[1]][1]),
    ); // reveal top to bottom
  })();
  /* the detailed lines: eyes, brows, nose and lips */
  const FEATURES = (() => {
    const L = [],
      z = (x, extra) => 0.55 * (1 - Math.min(1, x * x)) + (extra || 0);
    const line = (pts, extra, closed) =>
      L.push({
        p: pts.map(([x, y]) => {
          const [nx, ny] = P_(x, y);
          return [nx, ny, z(nx, extra)];
        }),
        closed: !!closed,
      });
    [
      [418, 208, -1],
      [602, 208, 1],
    ].forEach(([cx, cy, dir]) => {
      const outer = cx + dir * 66,
        inner = cx - dir * 70,
        up = [],
        low = [],
        crease = [],
        lash = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12,
          x = outer + (inner - outer) * t,
          s = Math.sin(Math.PI * t);
        up.push([x, cy + 4 - 27 * Math.pow(s, 0.8)]);
        low.push([x, cy + 4 + 22 * Math.pow(s, 1.1)]);
        crease.push([x, cy - 2 - 36 * Math.pow(s, 0.85)]);
        lash.push([x, cy + 8 + 26 * Math.pow(s, 1.1)]);
      }
      line(up, -0.04);
      line(low, -0.04);
      line(crease, -0.02);
      line(lash, -0.04);
      const iris = [],
        pupil = [];
      for (let k = 0; k <= 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        iris.push([cx + 17 * Math.cos(a), cy + 3 + 17 * Math.sin(a)]);
        pupil.push([cx + 6 * Math.cos(a), cy + 3 + 6 * Math.sin(a)]);
      }
      line(iris, -0.02, true);
      line(pupil, -0.02, true);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        line(
          [
            [cx + 6 * Math.cos(a), cy + 3 + 6 * Math.sin(a)],
            [cx + 17 * Math.cos(a), cy + 3 + 17 * Math.sin(a)],
          ],
          -0.02,
        );
      }
      for (let s = 0; s < 4; s++) {
        // eyebrow: a bundle of strokes
        const brow = [];
        for (let k = 0; k <= 10; k++) {
          const t = k / 10,
            x = cx - dir * 72 + dir * 140 * t * -1 * -1,
            bx = cx - dir * 72 + dir * 140 * t;
          const peak = Math.sin(Math.PI * Math.min(1, t * 1.15));
          brow.push([
            bx,
            168 - 26 * peak - s * 5 + (t > 0.8 ? (t - 0.8) * 40 : 0) + (s === 3 ? 4 * t : 0),
          ]);
        }
        line(brow, 0.02);
      }
    });
    line(
      [
        [497, 180],
        [492, 250],
        [478, 305],
      ],
      0.2,
    );
    line(
      [
        [523, 180],
        [528, 250],
        [542, 305],
      ],
      0.2,
    ); // sides of the nose
    line(
      [
        [470, 322],
        [460, 340],
        [472, 352],
        [490, 350],
        [500, 344],
      ],
      0.25,
    );
    line(
      [
        [550, 322],
        [560, 340],
        [548, 352],
        [530, 350],
        [520, 344],
      ],
      0.25,
    );
    line(
      [
        [488, 330],
        [498, 342],
        [510, 346],
        [522, 342],
        [532, 330],
      ],
      0.3,
    );
    line(
      [
        [420, 428],
        [445, 416],
        [468, 409],
        [492, 402],
        [510, 408],
        [528, 402],
        [552, 409],
        [575, 416],
        [598, 428],
      ],
      0.1,
    ); // upper lip
    line(
      [
        [420, 428],
        [460, 430],
        [510, 434],
        [560, 430],
        [598, 428],
      ],
      0.1,
    ); // mouth line
    line(
      [
        [425, 431],
        [462, 438],
        [510, 441],
        [558, 438],
        [593, 431],
      ],
      0.1,
    );
    line(
      [
        [420, 428],
        [445, 445],
        [475, 457],
        [510, 463],
        [545, 457],
        [575, 445],
        [598, 428],
      ],
      0.1,
    ); // lower lip
    line(
      [
        [510, 385],
        [504, 402],
      ],
      0.12,
    );
    line(
      [
        [510, 385],
        [516, 402],
      ],
      0.12,
    );
    return L;
  })();
  const TAGS = [
    ["NOSE_TIP", 510, 350],
    ["L_EYE", 418, 208],
    ["R_EYE", 602, 208],
    ["MOUTH", 598, 428],
    ["JAW", 510, 522],
  ].map(([n, x, y]) => {
    const [nx, ny] = P_(x, y);
    return [n, nx, ny];
  });
  let scanRaf = null,
    scanT0 = 0,
    scanPhase = 0,
    shownPts = 0,
    shownEdges = 0,
    featAlpha = 0,
    locked = false;
  const FACE_ORDER = FACE.map((p, i) => i).sort((a, b) => FACE[a].y - FACE[b].y); // dots appear top to bottom

  // Match the face canvas to its on-screen size (sharp on retina screens too).
  function sizeFace() {
    const r = fc.getBoundingClientRect(),
      d = Math.min(devicePixelRatio || 1, 2);
    fc.width = Math.max(1, r.width * d);
    fc.height = Math.max(1, r.height * d);
    fx.setTransform(d, 0, 0, d, 0, 0);
  }

  /* Turn a 3D face point into a 2D screen position.
     The head slowly turns left and right, so x is rotated around the y axis. */
  function project(x, y, z, t, w, h) {
    const yaw = Math.sin(t * 0.6) * 0.16,
      s = Math.min(w, h * 0.78) * 0.34;
    return [w / 2 + (x * Math.cos(yaw) + z * Math.sin(yaw)) * s, h * 0.47 + y * s];
  }

  /* Draw one frame of the face scan: background noise, mesh lines,
     eye/nose/lip details, glowing dots and the little labels. */
  function drawFace(now) {
    const w = fc.clientWidth,
      h = fc.clientHeight,
      t = (now - scanT0) / 1000;
    fx.clearRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      fx.fillStyle = `rgba(43,217,74,${Math.random() * 0.1})`;
      fx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
    const col = locked ? "182,255,106" : "43,217,74";
    const PP = FACE.map((p) => project(p.x, p.y, p.z, t, w, h));
    const shown = new Set(FACE_ORDER.slice(0, shownPts));
    fx.lineWidth = 0.8;
    fx.strokeStyle = `rgba(${col},.42)`;
    fx.beginPath();
    for (let k = 0; k < shownEdges; k++) {
      const [a, b] = EDGES[k];
      if (!shown.has(a) || !shown.has(b)) continue;
      fx.moveTo(PP[a][0], PP[a][1]);
      fx.lineTo(PP[b][0], PP[b][1]);
    }
    fx.stroke();
    if (featAlpha > 0) {
      fx.strokeStyle = `rgba(${col},${0.85 * featAlpha})`;
      fx.lineWidth = 1.1;
      FEATURES.forEach((f) => {
        fx.beginPath();
        f.p.forEach(([x, y, z], i) => {
          const [X, Y] = project(x, y, z, t, w, h);
          i ? fx.lineTo(X, Y) : fx.moveTo(X, Y);
        });
        if (f.closed) fx.closePath();
        fx.stroke();
      });
      fx.fillStyle = `rgba(${col},${featAlpha})`;
      [
        [418, 211],
        [602, 211],
      ].forEach(([x, y]) => {
        const [nx, ny] = P_(x, y);
        const [X, Y] = project(nx, ny, 0.4, t, w, h);
        fx.beginPath();
        fx.arc(X, Y, 3, 0, 6.29);
        fx.fill();
      });
    }
    FACE_ORDER.slice(0, shownPts).forEach((i, k) => {
      const p = FACE[i],
        [x, y] = PP[i],
        fresh = k === shownPts - 1 && scanPhase === 1;
      fx.fillStyle = `rgba(${col},${p.mark || fresh ? 1 : 0.6})`;
      fx.shadowColor = `rgb(${col})`;
      fx.shadowBlur = fresh ? 14 : p.mark ? 6 : 0;
      fx.beginPath();
      fx.arc(x, y, fresh ? 3.6 : p.mark ? 2.6 : 1.4, 0, 6.29);
      fx.fill();
    });
    fx.shadowBlur = 0;
    if (scanPhase >= 2) {
      fx.font = "10px 'JetBrains Mono', monospace";
      TAGS.forEach(([label, nx, ny], n) => {
        const [x, y] = project(nx, ny, 0.3, t, w, h),
          dx = (x < w / 2 ? -1 : 1) * (46 + n * 3),
          ty = y - 16 - n * 2;
        fx.strokeStyle = `rgba(${col},.7)`;
        fx.lineWidth = 1;
        fx.beginPath();
        fx.moveTo(x, y);
        fx.lineTo(x + dx * 0.6, ty);
        fx.lineTo(x + dx, ty);
        fx.stroke();
        fx.fillStyle = `rgba(${col},.95)`;
        fx.textAlign = dx < 0 ? "right" : "left";
        fx.fillText(label + " " + (x / w).toFixed(2), x + dx + (dx < 0 ? -4 : 4), ty + 3);
      });
      fx.textAlign = "left";
    }
  }

  // Keep redrawing the face every frame while the scan screen is open.
  function scanLoop(now) {
    drawFace(now);
    scanRaf = requestAnimationFrame(scanLoop);
  }

  // Stop the face animation and the hum.
  function scanStop() {
    cancelAnimationFrame(scanRaf);
    scanRaf = null;
    humOff();
  }

  /* Screen 3: the fake face scan. It runs in timed phases:
     dots appear -> mesh is built -> match % climbs -> target locked. */
  function scan() {
    show("s-scan");
    sizeFace();
    const vp = $("viewport"),
      st = $("scanStatus");
    vp.classList.remove("locked");
    $("lock").classList.add("hidden");
    $("sweep").classList.remove("on");
    shownPts = 0;
    shownEdges = 0;
    featAlpha = 0;
    scanPhase = 0;
    locked = false;
    $("roPts").textContent = "0/" + FACE.length;
    $("roDepth").textContent = "0%";
    $("roMatch").textContent = "0%";
    st.textContent = "INITIALIZING SCANNER…";
    scanT0 = performance.now();
    if (!scanRaf) scanRaf = requestAnimationFrame(scanLoop);
    humOn();
    let sec = 0;
    const clock = () => {
      $("camTime").textContent = "00:" + pad(sec++);
      if (sec < 60) later(clock, 1000);
    };
    clock();
    /* phase 1: points */
    later(() => {
      scanPhase = 1;
      $("sweep").classList.add("on");
      st.textContent = "MAPPING FACIAL POINTS…";
      const each = 3200 / FACE.length;
      FACE.forEach((_, i) =>
        later(() => {
          shownPts = i + 1;
          $("roPts").textContent = shownPts + "/" + FACE.length;
          if (i % 2 === 0) sfx("point");
        }, i * each),
      );
    }, 900);
    /* phase 2: mesh + depth */
    later(() => {
      scanPhase = 2;
      st.textContent = "BUILDING 3D MESH…";
      const steps = 40;
      for (let k = 1; k <= steps; k++)
        later(() => {
          shownEdges = Math.round((EDGES.length * k) / steps);
          featAlpha = k / steps;
          $("roDepth").textContent = Math.round((100 * k) / steps) + "%";
          if (k % 4 === 0) sfx("line");
        }, k * 50);
    }, 4300);
    /* phase 3: match */
    later(() => {
      scanPhase = 3;
      st.textContent = "MATCHING IDENTITY…";
      for (let k = 1; k <= 30; k++)
        later(() => {
          const v = k === 30 ? 99 : Math.min(98, Math.round(k * 3.3 + Math.random() * 4));
          $("roMatch").textContent = v + "%";
          sfx("point");
        }, k * 65);
    }, 6600);
    /* lock */
    later(() => {
      locked = true;
      vp.classList.add("locked");
      $("lock").classList.remove("hidden");
      $("sweep").classList.remove("on");
      st.textContent = "FACE MATCH: 99%";
      sfx("lock");
    }, 8800);
    later(() => {
      scanStop();
      idTable();
    }, 10600);
  }

  /* ---------------- 4. identity table ---------------- */
  // Screen 4: the identity card. Shows the name and date, then flips to MISMATCH.
  function idTable() {
    show("s-id");
    const now = new Date();
    $("idName").textContent = C.name;
    $("idDay").textContent = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
    $("idDate").textContent = now
      .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      .toUpperCase();
    $("idRef").textContent = "#" + String((Math.random() * 90000 + 10000) | 0);
    $("idMatch").textContent = "99%";
    $("idMatch").className = "";
    const st = $("idStatus");
    st.textContent = "VERIFYING…";
    st.className = "pending";
    $("idAlert").classList.add("hidden");
    $("idNext").textContent = "";
    [0, 400, 800, 1200].forEach((d) => later(() => sfx("click"), d));
    later(() => {
      st.textContent = "MISMATCH";
      st.className = "fail";
      $("idMatch").textContent = "??%";
      $("idMatch").className = "fail";
      $("idAlert").classList.remove("hidden");
      const card = $("idcard");
      card.classList.remove("shake");
      void card.offsetWidth;
      card.classList.add("shake");
      alarm(true);
      sfx("alarm");
      later(
        () =>
          type($("idNext"), "> image unclear… switching to override mode", 35, () =>
            later(hack, 1200),
          ),
        1300,
      );
    }, 2200);
  }

  /* ---------------- 5. hack sequence ---------------- */
  const cc = $("code"),
    cx = cc.getContext("2d");
  let codeRaf = null,
    codeCols = [],
    noiseLevel = 0;
  const TOKENS = [
    "0x7F",
    "sudo",
    "rm -rf",
    "AES256",
    "fn()",
    "{ }",
    "<root>",
    "0101",
    "ssh",
    "PING",
    "hash",
    "0xDEAD",
    "kernel",
    "exec",
    "::1",
    "sig",
  ];

  // Resize the falling-code canvas.
  function sizeCode() {
    const d = Math.min(devicePixelRatio || 1, 2);
    cc.width = innerWidth * d;
    cc.height = innerHeight * d;
    cx.setTransform(d, 0, 0, d, 0, 0);
    codeCols = Array.from(
      { length: Math.ceil(innerWidth / 18) },
      () => Math.random() * -innerHeight,
    );
  }

  // Falling code + TV static + random screen tears for the hack screen.
  function codeLoop() {
    const w = innerWidth,
      h = innerHeight;
    cx.fillStyle = "rgba(0,0,0,.18)";
    cx.fillRect(0, 0, w, h);
    cx.font = "14px 'JetBrains Mono', monospace";
    codeCols.forEach((y, i) => {
      const r = Math.random();
      cx.fillStyle = r > 0.97 ? "#ffffff" : r > 0.9 ? "#ff2b4a" : "#2bd94a";
      const s =
        Math.random() < 0.08
          ? TOKENS[(Math.random() * TOKENS.length) | 0]
          : "01ABCDEF<>/{}#$"[(Math.random() * 15) | 0];
      cx.fillText(s, i * 18, y);
      codeCols[i] = y > h + Math.random() * 500 ? 0 : y + 16;
    });
    const n = (noiseLevel * 900) | 0;
    for (let i = 0; i < n; i++) {
      const v = (Math.random() * 255) | 0;
      cx.fillStyle = `rgb(${v},${v},${v})`;
      cx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    if (Math.random() < noiseLevel * 0.25) {
      const y = Math.random() * h,
        bh = 6 + Math.random() * 40;
      cx.drawImage(
        cc,
        0,
        y * (cc.width / w),
        cc.width,
        bh * (cc.height / h),
        (Math.random() - 0.5) * 60,
        y,
        w,
        bh,
      );
    }
    codeRaf = requestAnimationFrame(codeLoop);
  }

  // Stop the falling code animation.
  function codeStop() {
    cancelAnimationFrame(codeRaf);
    codeRaf = null;
  }

  // Screen 5: the hack. Log lines appear, the progress bar fills, then boom.
  function hack() {
    show("s-hack");
    sizeCode();
    noiseLevel = 0.15;
    cx.fillStyle = "#000";
    cx.fillRect(0, 0, innerWidth, innerHeight);
    if (!codeRaf) codeRaf = requestAnimationFrame(codeLoop);
    putMask($("maskBox2"));
    sfx("glitch");
    const log = $("hackLog"),
      bar = $("hackBar");
    log.replaceChildren();
    bar.textContent = "";
    const LINES = [
      ["> bypassing firewall ........ ", "OK", ""],
      ["> breaking encryption ....... ", "OK", ""],
      ["> overriding identity check .. ", "OK", ""],
      ["> unknown file found: ", "birthday.exe", "r"],
      ["> executing ", "birthday.exe", ""],
    ];
    LINES.forEach(([a, b, cls], i) =>
      later(
        () => {
          const row = document.createElement("div"),
            s = document.createElement("span");
          if (cls) s.className = cls;
          s.textContent = b;
          row.append(a, s);
          log.append(row);
          noiseLevel = Math.min(1, noiseLevel + 0.14);
          sfx(i === 3 ? "alarm" : "static");
          const scr = $("s-hack");
          scr.classList.remove("tear");
          void scr.offsetWidth;
          scr.classList.add("tear");
        },
        700 + i * 900,
      ),
    );
    const W = 28;
    let p = 0;
    const tick = () => {
      p = Math.min(100, p + 1.4 + Math.random() * 2.2);
      const f = Math.round((p / 100) * W);
      bar.textContent =
        "[" +
        "#".repeat(f) +
        "-".repeat(W - f) +
        "] " +
        String(Math.round(p)).padStart(3, " ") +
        "%";
      if (Math.random() < 0.12) sfx("static");
      if (p < 100) later(tick, 85);
      else later(boom, 500);
    };
    later(tick, 500);
  }

  // White flash + bass hit, then straight into the birthday screen.
  function boom() {
    sfx("boom");
    sfx("glitch");
    const fl = document.createElement("div");
    fl.className = "flash";
    document.body.append(fl);
    later(() => fl.remove(), 700);
    codeStop();
    party();
  }

  /* ---------------- 6. celebration ---------------- */
  const pc = $("party"),
    px = pc.getContext("2d");
  let parts = [],
    bits = [],
    pRaf = null,
    pT0 = 0;

  // Resize the celebration background canvas.
  function sizeParty() {
    const d = Math.min(devicePixelRatio || 1, 2);
    pc.width = innerWidth * d;
    pc.height = innerHeight * d;
    px.setTransform(d, 0, 0, d, 0, 0);
  }

  // Background animation on the birthday screen (falling 1s and 0s).
  function partyLoop(now) {
    const t = (now - pT0) / 1000,
      w = innerWidth,
      h = innerHeight;
    px.fillStyle = "rgba(2,7,10,.35)";
    px.fillRect(0, 0, w, h);
    parts.forEach((p) => {
      const k = Math.min(1, Math.max(0, (t - p.delay) / 1.4)),
        e = 1 - Math.pow(1 - k, 3);
      let x = p.sx + (p.tx - p.sx) * e,
        y = p.sy + (p.ty - p.sy) * e;
      if (k >= 1) {
        x += Math.sin(t * 3 + p.ph) * 0.6;
        y += Math.cos(t * 2.6 + p.ph) * 0.6;
      }
      if (p.flame && k >= 1) {
        y -= Math.abs(Math.sin(t * 9 + p.ph)) * 3;
      }
      px.fillStyle = p.flame && Math.random() < 0.3 ? "#ff2b4a" : p.c;
      px.fillRect(x, y, p.s, p.s);
    });
    if (t > 1.8 && bits.length < 45 && !reduce) {
      bits.push({
        x: Math.random() * w,
        y: -10,
        vy: 1 + Math.random() * 2.2,
        ch: Math.random() < 0.5 ? "1" : "0",
        c: ["#2bd94a", "#b6ff6a", "#ffffff", "#ffc23d", "#ff2b4a"][(Math.random() * 5) | 0],
      });
    }
    px.font = "13px 'JetBrains Mono', monospace";
    px.globalAlpha = 0.55;
    bits.forEach((b) => {
      b.y += b.vy;
      px.fillStyle = b.c;
      px.fillText(b.ch, b.x, b.y);
    });
    px.globalAlpha = 1;
    bits = bits.filter((b) => b.y < h + 20);
    pRaf = requestAnimationFrame(partyLoop);
  }

  // Stop everything that runs on the birthday screen.
  function partyStop() {
    cancelAnimationFrame(pRaf);
    pRaf = null;
    parts = [];
    bits = [];
    clearInterval(flameTimer);
  }
  /* text cake with flickering candles (same as the first page) */
  const CAKE = [
    "      *   *   *   *   *",
    "      |   |   |   |   |",
    "  ╔═══════════════════════╗",
    "  ║░░░░░░░░░░░░░░░░░░░░░░░║",
    "  ╠═══════════════════════╣",
    "  ║                       ║",
    "  ╚═══════════════════════╝",
  ];
  let flameTimer = null;

  // Draw the text cake and make the candle flames flicker.
  function drawCake() {
    const el = $("cake");
    el.textContent = "";
    // Every character gets its own fixed-width cell, so the cake stays lined up
    // even when a phone/PC draws the box lines with a different (wider) font than the spaces.
    CAKE.forEach((line) => {
      const row = document.createElement("span");
      row.className = "cake-row";
      Array.from(line).forEach((ch) => {
        const cell = document.createElement("span");
        cell.className = ch === "*" ? "cell fl" : "cell";
        cell.textContent = ch;
        row.append(cell);
      });
      el.append(row);
    });
    clearInterval(flameTimer);
    const chars = ["*", "'", ".", "*", "\u00b7"];
    flameTimer = setInterval(() => {
      el.querySelectorAll(".fl").forEach((s) => {
        s.textContent = chars[(Math.random() * chars.length) | 0];
      });
    }, 220);
  }

  // Screen 6: Happy Birthday! Big block letters, the cake, music and the message.
  function party() {
    alarm(false);
    document.body.classList.add("calm");
    show("s-party");
    sizeParty();
    px.fillStyle = "#02070a";
    px.fillRect(0, 0, innerWidth, innerHeight);
    parts = [];
    const art = $("hbArt");
    art.classList.remove("glitch");
    void art.offsetWidth;
    art.classList.add("glitch");
    drawCake();
    const card = $("partyCard");
    card.classList.remove("show");
    pT0 = performance.now();
    if (!pRaf) pRaf = requestAnimationFrame(partyLoop);
    $("muteBtn").classList.remove("hidden");
    songOn();
    $("wish2").textContent = C.wish2;
    $("wish2").classList.remove("show");
    $("wish").textContent = "";
    later(() => {
      card.classList.add("show");
      type($("wish"), C.wish, 40, () => later(() => $("wish2").classList.add("show"), 250));
    }, 1200);
  }

  /* call + replay + mute */
  const callBtn = $("callBtn");
  callBtn.textContent = C.callText;
  if (C.phone) callBtn.href = "tel:" + C.phone;
  else callBtn.removeAttribute("href");
  callBtn.addEventListener("click", () => sfx("ok"));

  $("replayBtn").addEventListener("click", () => {
    RUN++;
    songOff();
    partyStop();
    codeStop();
    scanStop();
    document.body.classList.remove("calm");
    $("muteBtn").classList.add("hidden");
    ["no1", "no2"].forEach((id) => {
      $(id).classList.remove("gone", "hidden");
    });
    document.querySelectorAll(".sep").forEach((s) => s.classList.remove("hidden"));
    step1();
  });
  $("muteBtn").addEventListener("click", () => {
    muted = !muted;
    $("muteBtn").textContent = muted ? "SOUND: OFF" : "SOUND: ON";
    if (muted) songOff();
    else songOn();
  });
  addEventListener("resize", () => {
    sizeBg();
    if (scanRaf) sizeFace();
    if (codeRaf) sizeCode();
    if (pRaf) sizeParty();
  });

  /* ---------------- go ---------------- */
  step1();
})();
