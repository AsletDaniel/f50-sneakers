# adidas F50 — FAST FORWARD

Prototipo brutalista para los sneakers F50 (rosa solar). Lenguaje visual tomado
de `assets/identity.png`: blanco de estudio, bloque rosa, marcas de registro de
imprenta, tipografía techno (Michroma) + mono técnica (IBM Plex Mono).

## Correr

Servidor "f50-sneakers" en `~/.claude/launch.json` → http://localhost:8855

## Estructura

- **Intro**: cuadrícula de celdas negras que se disuelve con barrido diagonal +
  ruido; ~22% de las celdas hacen flash rosa antes de morir. Skippable (botón SKIP).
  Flag de dev: `#freeze` en la URL congela la intro antes del dissolve.
- **Hero**: video `assets/hero.mp4` (autoplay muted, 4 s, 1920×1080 — copia de
  Video1.mp4): los sneakers caen del cielo y el video congela en el último frame.
  Si el video faltara, hay fallback automático donde `pair.png` cae con rebote
  sobre `whitebg.png` (bordes difuminados con mask).
- **Hero** (calcado del banner `assets/identity.png`): logo adidas apilado,
  wordmark F50 en outline (`-webkit-text-stroke`, fill transparente) sobre bloque
  rosa a media altura, FAST FORWARD + línea, ENGINEERED FOR SPEED, cuadro negro,
  barra negra + hairline vertical a la izquierda, tabla técnica abajo-derecha.
- **02 — MATERIAL STUDY**: TODO vive en la misma pantalla (la página no scrollea,
  `overflow: clip`). El scroll (wheel/touch/flechas) es un cambio de estado RÁPIDO
  (~1.7 s el proceso completo):
  - Scroll abajo → cascada de salida (delays .03s), crossfade .28s, Video2 a
    playbackRate 2.3; al 68% del video se dibujan los callouts estilo plano
    técnico: flechas con punta hacia el material, arco + crosshair en el talón,
    círculo con crosshair al centro, outsole subrayado con diagonal. El CTA muta
    "BUY F50" → "VIEW PRODUCT DETAILS →" con flash rosa.
  - Scroll arriba → regresa al hero (cascada inversa).
  - `.settled` (JS, tras el reveal) habilita el modo transición de los stamps.
  - Video2 se carga como blob (python http.server no da Range requests; sin blob
    no sería seekable ni reiniciable).
  - En móvil los callouts se vuelven chips fijos (sin líneas/decorativos).
  Historial: se descartó una sección aparte (2 pantallas) y un scrub scroll-driven.
- **03 — MATERIAL STUDY completo** (diseño agresivo, calcado de la referencia
  del usuario): tercer scroll. `assets/detail.mp4` (Video3): la cámara se aleja
  del macro hasta la bota flotante; al asentarse entra `float.png` (HQ) y la
  clase `done` en `#detailLayer` dispara en cascada: título con la tipografía
  real (`assets/title.png`, wordmark F50 con bloque rosa) + "MATERIAL STUDY",
  callouts agresivos (cuadro negro + etiqueta subrayada + tick rosa + codo
  diagonal, outsole con flecha), geometría blueprint SVG alrededor de la bota
  (viewBox 1920×1080 con `slice` = mismo encuadre que el video cover), cruces y
  cuadros de imprenta en los bordes, y botón grande "VIEW PRODUCT DETAILS →"
  con sombra rosa al centro-abajo. El logo adidas del nav se retira en este
  estado (el título ocupa su esquina). CTA muta a "ADD TO CART →".
- **Reproducción de los videos de estado**: NO usan `video.play()` — Chromium
  pausa media sin audio en tabs de fondo ("video-only background media…
  save power"). Se "reproducen" manejando `currentTime` con un motor de
  `setTimeout` (~30 fps, seeks encadenados vía `seeked`) sobre el blob seekable
  (`scrubDrive` en app.js). rAF tampoco sirve: se congela en tabs ocultos.
  El hero sí usa play() (autoplay tras el reveal, a 1.8×) con red de seguridad:
  si algo lo pausa a medio vuelo, se presenta la foto final.
- **Velocidades**: hero 1.8× (~2.2 s), estados 02/03 a 2.5× (~1.6 s).
- **Respiración: ELIMINADA** — se probó en media y en página completa y el
  usuario la descartó en ambas.
- **Hero con la tipografía real**: el h1 usa `assets/title.png` (wordmark F50
  con bloque rosa horneado); un `::before` extiende el bloque rosa a sangre
  hasta el borde izquierdo y la barra negra (`z-index: 7`) queda encima.
- **Reversa en el scroll**: al subir, el video del estado corre EN REVERSA
  (`scrubDrive(v, from, to, …)` acepta dirección) y al llegar a 0 se quita la
  clase del estado — nunca se salta de golpe. Gotcha: durante la reversa el
  `timeupdate` pasa por el umbral de callouts; `fired` se fuerza a true en la
  ida atrás para que no se re-disparen.
- **03 animado brutalista**: blueprint que se DIBUJA (pathLength/dashoffset con
  stagger), barrido de escaneo rosa (`.d-scan`), glitch del título al aterrizar,
  ticks rosas pulsantes, cuadros negros parpadeando.
- **Botones**: esquinas cortadas con `clip-path` + sombra rosa vía
  `filter: drop-shadow` (box-shadow no funciona con clip-path). El grande lleva
  cuadrito rosa parpadeante integrado.

## Calidad: swap a foto al terminar cada animación

Los videos son 1080p comprimido; las fotos son nítidas. Al terminar cada
animación, el frame final del video se sustituye con crossfade (.5s) por la
foto en alta calidad (elemento `.hq`, mismo `object-fit: cover` y mismo aspecto
16:9, así el encuadre coincide):

- Hero: `heroVideo` ended → `pair.png` (1.png).
- Estudio: `studyVideo` ended → `macro-clean.png` (3notext.png, versión sin
  textos que preparó el usuario). Se resetea al salir/re-entrar.
- `float.png` (4notext.png, bota flotante limpia) está copiada en assets,
  reservada para el futuro estado de "VIEW PRODUCT DETAILS".

## Optimización

- Fotos servidas como JPEG q82 (de ~6.7 MB en PNG a ~0.6 MB); solo `title.png`
  queda en PNG (necesita alfa). Logo real en `assets/adidas.jpg` (JPG blanco)
  fundido con `mix-blend-mode: multiply` sobre fondo papel del contenedor.
- Los videos de estado (scroll/detail, ~14 MB) se descargan DESPUÉS del reveal
  del hero (evento `f50:revealed`) para no competir con `hero.mp4`.
- `user-select: none` global y `-webkit-user-drag: none` + `draggable=false`
  en todas las imágenes: nada se arrastra ni se selecciona.
- El rosa global `--pink` es ahora `#fd3572`, muestreado del wordmark; la
  sangría izquierda del título usa el gradiente exacto del borde del PNG
  (`#fc296e → #fd3172`, top 2.3%, alto 89.5%) — sin seam de dos colores.

## Assets

Originales en `~/Documents/Websites Prototipes/F50 Sneakers/` (el server no puede
leer Documents, por eso están copiados aquí): pair (1.png), identity (2.png),
macro (3.png), study (4.png), whitebg.
