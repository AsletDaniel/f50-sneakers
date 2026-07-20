/* ============================================================
   adidas F50 — intro grid dissolve + hero reveal
   ============================================================ */

(() => {
  const intro    = document.getElementById("intro");
  const grid     = document.getElementById("introGrid");
  const line     = document.getElementById("introLine");
  const mark     = document.getElementById("introMark");
  const skip     = document.getElementById("introSkip");
  const hero     = document.getElementById("hero");
  const video    = document.getElementById("heroVideo");
  const reduced  = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- video o fallback ---------- */
  // Si assets/hero.mp4 no existe todavía, activamos el modo fallback:
  // los sneakers (pair.png) caen del cielo sobre el fondo de estudio.
  let videoOk = null; // null = aún no sabemos
  const useFallback = () => { videoOk = false; hero.classList.add("no-video"); };
  const useVideo    = () => { videoOk = true; };

  video.addEventListener("error", useFallback, true);
  video.querySelector("source").addEventListener("error", useFallback);
  video.addEventListener("loadeddata", useVideo);

  // al terminar la caída, el frame final se sustituye por pair.png (alta calidad)
  const hqHero = document.getElementById("hqHero");
  video.addEventListener("ended", () => hqHero.classList.add("show"));
  // si el ahorro de energía de Chromium pausara el video a medio vuelo
  // (video-only media en tab oculto), presentamos la foto final
  video.addEventListener("pause", () => {
    if (!video.ended && videoOk) hqHero.classList.add("show");
  });

  // el error del <source> puede dispararse antes de registrar los listeners
  // (404 rápido/cacheado), así que también comprobamos el estado directamente
  const checkVideoState = () => {
    if (videoOk !== null) return;
    if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) useFallback();
    else if (video.readyState >= 2) useVideo();
  };
  checkVideoState();

  const startMedia = () => {
    checkVideoState();
    if (videoOk === false) return; // fallback ya animado vía CSS (.revealed)
    video.playbackRate = 1.8; // caída más ágil (~2.2 s)
    const p = video.play();
    if (p) p.catch(() => {});
  };

  /* ---------- construir la cuadrícula ---------- */
  const isMobile = window.innerWidth < 820;
  const COLS = isMobile ? 8 : 16;
  const ROWS = isMobile ? 14 : 9;
  grid.style.setProperty("--cols", COLS);
  grid.style.setProperty("--rows", ROWS);

  const cells = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const c = document.createElement("div");
    c.className = "intro-cell";
    grid.appendChild(c);
    cells.push(c);
  }

  /* ---------- secuencia ---------- */
  let finished = false;

  const reveal = () => {
    if (finished) return;
    finished = true;
    intro.classList.add("done");
    hero.classList.add("revealed");
    startMedia();
    // avisa a la capa de estados que ya puede descargar sus videos
    window.dispatchEvent(new Event("f50:revealed"));
    // tras la cascada inicial, el UI pasa a modo transición (cambio de estado)
    setTimeout(() => hero.classList.add("settled"), 1200);
  };

  const dissolve = () => {
    line.classList.remove("on");
    mark.classList.remove("on");
    // orden pseudo-aleatorio con sesgo diagonal (ruido de imprenta)
    cells.forEach((c, i) => {
      const col = i % COLS;
      const row = (i / COLS) | 0;
      const diag = (col / COLS + row / ROWS) * 260;          // barrido diagonal
      const noise = Math.random() * 480;                      // ruido
      const d = Math.round(diag + noise);
      c.style.setProperty("--d", d + "ms");
      c.classList.add("out");
      if (Math.random() < 0.22) c.classList.add("flash");
    });
    // fin del dissolve: diag máx (260*2=520) + ruido máx (480) + anim (240)
    setTimeout(reveal, 1280);
  };

  const sequence = () => {
    if (reduced) { reveal(); return; }
    setTimeout(() => line.classList.add("on"), 350);
    setTimeout(() => mark.classList.add("on"), 1050);
    if (location.hash === "#freeze") return; // dev: congela la intro
    setTimeout(dissolve, 1750);
  };

  skip.addEventListener("click", reveal);

  // si el video existe, esperamos a que tenga data antes de arrancar
  // la secuencia (máx 900 ms) para que el reveal caiga sobre el primer frame
  let started = false;
  const begin = () => { if (!started) { started = true; checkVideoState(); sequence(); } };
  video.addEventListener("loadeddata", begin);
  video.addEventListener("error", begin, true);
  setTimeout(begin, 900);
})();

/* ============================================================
   02 — MATERIAL STUDY: misma pantalla, el scroll cambia de estado
   Scroll abajo → el hero UI sale en cascada, entra el video 2 y
   los callouts blueprint se dibujan sincronizados.
   Scroll arriba → regresa al hero.
   ============================================================ */

(() => {
  const hero     = document.getElementById("hero");
  const video    = document.getElementById("studyVideo");
  const dVideo   = document.getElementById("detailVideo");
  const navCta   = document.getElementById("navCta");
  const hqStudy  = document.getElementById("hqStudy");
  const hqDetail = document.getElementById("hqDetail");
  const dLayer   = document.getElementById("detailLayer");
  const bps      = [...document.querySelectorAll(".bp")];
  const decors   = [...document.querySelectorAll(".decor")];
  const reduced  = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const RATE     = 2.5; // todos los videos de estado corren acelerados (~1.6 s)

  // al asentarse cada video, sustituye su frame final por la foto en HQ
  const studyDone = () => {
    if (hero.classList.contains("studying")) hqStudy.classList.add("show");
  };
  const detailDone = () => {
    if (hero.classList.contains("detailing")) {
      hqDetail.classList.add("show");
      dLayer.classList.add("done"); // dispara callouts, blueprint y botón
    }
  };

  // "reproducción" manejando currentTime por rAF sobre el blob seekable:
  // video.play() sin pista de audio puede ser pausado por el ahorro de
  // energía de Chromium ("video-only background media"); esto lo evita y
  // da control total del ritmo. Seeks encadenados vía `seeked` para que
  // cada frame pintado sea un decode completo.
  // reproduce de `from` a `to` (adelante o REVERSA según el orden)
  const scrubDrive = (v, from, to, rate, isActive, onEnd) => {
    if (!v.duration) {
      v.addEventListener("loadedmetadata", () => scrubDrive(v, from, to, rate, isActive, onEnd), { once: true });
      return;
    }
    const start = performance.now();
    const dir = to >= from ? 1 : -1;
    const span = Math.abs(to - from);
    let pending = null;
    v.onseeked = () => {
      if (pending !== null) { const t = pending; pending = null; v.currentTime = t; }
    };
    const seekTo = (t) => {
      if (v.seeking) { pending = t; return; }
      if (Math.abs(v.currentTime - t) > 0.008) v.currentTime = t;
    };
    // setTimeout en vez de rAF: rAF se congela si el navegador considera
    // el tab en segundo plano (p. ej. el preview), los timers no
    const step = () => {
      if (!isActive()) return;
      const prog = Math.min(span, ((performance.now() - start) / 1000) * rate);
      seekTo(from + dir * prog);
      if (prog < span) setTimeout(step, 33);
      else if (onEnd) onEnd();
    };
    step();
  };
  const END = (v) => v.duration - 0.001;

  // blob: sin Range requests el mp4 no es seekable y no podríamos
  // reiniciarlo ni correrlo en reversa. Las descargas se difieren hasta
  // que el hero terminó de cargar para no competir con su video.
  let ready = false;
  let dReady = false;
  let fetched = false;
  const fetchStateVideos = () => {
    if (fetched) return;
    fetched = true;
    fetch("assets/scroll.mp4")
      .then(r => { if (!r.ok) throw 0; return r.blob(); })
      .then(b => { video.src = URL.createObjectURL(b); ready = true; })
      .catch(() => {});
    fetch("assets/detail.mp4")
      .then(r => { if (!r.ok) throw 0; return r.blob(); })
      .then(b => { dVideo.src = URL.createObjectURL(b); dReady = true; })
      .catch(() => {});
  };
  window.addEventListener("f50:revealed", fetchStateVideos, { once: true });
  setTimeout(fetchStateVideos, 4000); // red de seguridad

  // nada de arrastrar imágenes (Firefox ignora -webkit-user-drag)
  document.querySelectorAll("img").forEach(i => { i.draggable = false; });

  // los callouts se dibujan en ráfaga cuando el video está por asentarse
  let fired = false;
  const showCallouts = () => {
    decors.forEach(d => d.classList.add("on"));
    bps.forEach((b, i) => setTimeout(() => b.classList.add("on"), i * 110));
  };
  video.addEventListener("timeupdate", () => {
    if (fired || !video.duration || state !== 1 || !hero.classList.contains("studying")) return;
    if (video.currentTime / video.duration >= 0.68) { fired = true; showCallouts(); }
  });

  // el botón del nav muta con un flash rosa
  const setCta = (html) => {
    navCta.classList.add("swap");
    setTimeout(() => { navCta.innerHTML = html; }, 110);
    setTimeout(() => navCta.classList.remove("swap"), 260);
  };

  let state = 0;   // 0 = hero, 1 = material study, 2 = product
  let busy  = false;
  const lock = (ms) => { busy = true; setTimeout(() => { busy = false; }, ms); };

  const toStudy = () => {
    if (!ready || !hero.classList.contains("settled")) return;
    state = 1;
    fired = false;
    lock(700);
    hero.classList.add("studying");
    setCta("VIEW&nbsp;PRODUCT&nbsp;DETAILS&nbsp;→");
    hqStudy.classList.remove("show");
    video.currentTime = 0;
    if (reduced) {
      // sin animaciones: directo a la foto HQ con todo visible
      hqStudy.classList.add("show");
      fired = true;
      showCallouts();
      return;
    }
    scrubDrive(video, 0, END(video), RATE, () => state === 1 && hero.classList.contains("studying"), studyDone);
  };

  const toHero = () => {
    state = 0;
    fired = true; // evita que timeupdate re-dispare callouts durante la reversa
    setCta("BUY&nbsp;F50");
    // los callouts salen y el video corre en REVERSA hasta el inicio
    bps.forEach(b => b.classList.remove("on"));
    decors.forEach(d => d.classList.remove("on"));
    hqStudy.classList.remove("show");
    if (reduced || !video.duration) {
      lock(600);
      hero.classList.remove("studying");
      return;
    }
    lock(video.currentTime / RATE * 1000 + 500);
    scrubDrive(video, video.currentTime, 0, RATE, () => state === 0,
      () => hero.classList.remove("studying"));
  };

  const toDetail = () => {
    if (!dReady) return;
    state = 2;
    lock(700);
    hero.classList.add("detailing");
    setCta("ADD&nbsp;TO&nbsp;CART&nbsp;→");
    hqDetail.classList.remove("show");
    dLayer.classList.remove("done");
    dVideo.currentTime = 0;
    if (reduced) {
      hqDetail.classList.add("show");
      dLayer.classList.add("done");
      return;
    }
    scrubDrive(dVideo, 0, END(dVideo), RATE, () => state === 2 && hero.classList.contains("detailing"), detailDone);
  };

  const backToStudy = () => {
    state = 1;
    setCta("VIEW&nbsp;PRODUCT&nbsp;DETAILS&nbsp;→");
    // los detalles salen y el video corre en REVERSA hasta el macro
    dLayer.classList.remove("done");
    hqDetail.classList.remove("show");
    if (reduced || !dVideo.duration) {
      lock(600);
      hero.classList.remove("detailing");
      return;
    }
    lock(dVideo.currentTime / RATE * 1000 + 500);
    scrubDrive(dVideo, dVideo.currentTime, 0, RATE, () => state === 1,
      () => hero.classList.remove("detailing"));
  };

  const intent = (dir) => {
    if (busy) return;
    if (dir > 0) {
      if (state === 0) toStudy();
      else if (state === 1) toDetail();
    } else {
      if (state === 2) backToStudy();
      else if (state === 1) toHero();
    }
  };

  window.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) > 18) intent(e.deltaY);
  }, { passive: true });

  let touchY = null;
  window.addEventListener("touchstart", (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (touchY === null) return;
    const d = touchY - e.touches[0].clientY;
    if (Math.abs(d) > 46) { intent(d); touchY = null; }
  }, { passive: true });

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "PageDown") intent(1);
    else if (e.key === "ArrowUp" || e.key === "PageUp") intent(-1);
  });
})();
