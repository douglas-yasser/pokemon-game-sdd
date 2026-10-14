import { BACKGROUNDS, CHARIZARD, getFrame, frameIndexAt } from './spritesheet.js';

// Por qué estas constantes: W/H fijan el canvas acordado (960x540),
// SCALE=2 duplica el sprite de 56x72 a 112x144 para que se aprecie,
// SPEED=220 px/s da un caminar visible (~3.6 px/frame a 60fps).
const W = 960;
const H = 540;
const SCALE = 2;
const SPEED = 220;

// Por qué clave versionada: una sola ranura en localStorage que sobrevive a
// cerrar el navegador y permite invalidar el formato con `v` si cambia (spec 02, paso 1).
const SAVE_KEY = 'pokemonGame.save.v1';
// Por qué 1000 ms: throttle del spec para no escribir en cada frame (~60 escrituras/s
// serían coste inútil); basta para ~100 bytes y cumple el criterio 1.
const SAVE_EVERY_MS = 1000;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false; // Por qué: mantiene el píxel nítido al escalar 2x.

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar: ' + src));
    img.src = src;
  });
}

// Estado del juego según spec 01 (paso 3): 'inicio' bloquea, 'jugando' permite moverse,
// 'victoria' muestra el volcán con el overlay y bloquea las flechas como en 'inicio'.
let estado = 'inicio';

// Estado del fondo según spec 01 (paso 3): 'fondo1' (bosque) al cargar y al resetear,
// cambia directo a 'fondo2' (volcán) al entrar con los pies en PORTAL (sin fundido).
let fondoActual = 'fondo1';

// Por qué estas medidas: derivadas de W=960,H=540 (960-80=880, (540-240)/2=150),
// franja fija de 80×240 en el borde derecho (decisión del spec, sin nuevos assets).
const PORTAL = { x: 880, y: 150, w: 80, h: 240 };

// Estado del jugador: (x, y) son los pies (punto shadow), dir una de las
// 8 direcciones de DIRECTIONS, y los relojes marcan cuándo empezó cada animación.
const player = { x: 480, y: 400, dir: 'down', moving: false, walkT0: 0, idleT0: 0 };

// Por qué lastSavedJson/lastSaveTime: el throttle limita a 1 intento/s y la
// comparación del string JSON completo detecta cualquier cambio (x/y/dir/
// estado/fondo) sin comparar campo a campo (spec 02, decisiones).
let lastSavedJson = null;
let lastSaveTime = 0;

// Por qué snapshot mínimo sin savedAt: nada lo lee; menos bytes y menos
// validación (spec 02, decisiones). Incluye v/estado/fondo/player.
function snapshot() {
  return {
    v: 1,
    estado,
    fondoActual,
    player: { x: player.x, y: player.y, dir: player.dir },
  };
}

// Por qué escribirGuardado: centraliza el único punto de escritura (throttle,
// ganar y pagehide lo reutilizan). Solo guarda en jugando/victoria, compara
// el JSON para no reescribir si nada cambió y traga errores de localStorage
// (modo privado / cuota) con try/catch para no romper el bucle.
function escribirGuardado() {
  if (estado !== 'jugando' && estado !== 'victoria') return;
  let json;
  try {
    json = JSON.stringify(snapshot());
  } catch {
    return;
  }
  if (json === lastSavedJson) return;
  try {
    localStorage.setItem(SAVE_KEY, json);
    lastSavedJson = json;
  } catch {
    // Por qué silencio: el juego debe seguir igual aunque no se pueda guardar.
  }
}

// Solo flechas (sin WASD, según lo acordado). Un Set permite diagonales
// (dos teclas a la vez) e ignora la auto-repetición del keydown.
const pressed = new Set();
pressed.clear(); // Por qué: estado limpio al cargar (spec 01, modelo de datos).
const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const pantallaInicio = document.getElementById('pantalla-inicio');
const pantallaVictoria = document.getElementById('pantalla-victoria');
const btnEmpezar = document.getElementById('btn-empezar');
const btnReiniciar = document.getElementById('btn-reiniciar');

// Por qué función empezar: centraliza el único paso inicio→jugando (clic o Enter),
// vacía flechas pegadas y oculta el overlay con la clase .oculta.
function empezar() {
  if (estado !== 'inicio') return;
  estado = 'jugando';
  pressed.clear(); // Por qué: evita que una flecha pulsada tras el overlay mueva de golpe.
  pantallaInicio.classList.add('oculta');
}

// Por qué ganar: centraliza el paso jugando→victoria al pisar el portal con los pies
// (player.x/y son el punto shadow), cambia directo a fondo2, vacía teclas y muestra el overlay.
function ganar() {
  if (estado !== 'jugando') return;
  estado = 'victoria';
  fondoActual = 'fondo2'; // Por qué directo: el spec descarta fundido; ambos fondos miden 2752×1536 con el mismo encuadre.
  pressed.clear(); // Por qué: al ganar se vacía (modelo de datos) para no arrastrar flechas.
  pantallaVictoria.classList.remove('oculta');
  // Por qué guardado puntual aquí: en victoria nada se mueve, así que el throttle
  // (solo activo en jugando) nunca lo persistiría; esto fija estado:'victoria'+fondo2 (criterio 3).
  escribirGuardado();
}

// Por qué volverAEmpezar: aplica el reset completo del spec (480,400,'down',fondo1,
// teclas vaciadas, relojes repuestos) y vuelve a 'inicio' para repetir el ciclo inicio→juego→victoria→inicio.
function volverAEmpezar() {
  if (estado !== 'victoria') return;
  estado = 'inicio';
  fondoActual = 'fondo1';
  player.x = 480;
  player.y = 400;
  player.dir = 'down';
  player.moving = false;
  const ahora = performance.now();
  player.walkT0 = ahora; // Por qué reponer: evita retomar a mitad de ciclo al repetir.
  player.idleT0 = ahora;
  pressed.clear(); // Por qué: al volver se vacía (modelo de datos).
  pantallaVictoria.classList.add('oculta');
  pantallaInicio.classList.remove('oculta');
  if (document.activeElement !== btnEmpezar) btnEmpezar.focus(); // Por qué: deja el foco listo para el siguiente Enter.
}

btnEmpezar.addEventListener('click', empezar);
btnReiniciar.addEventListener('click', volverAEmpezar); // Por qué solo clic: Enter se ignora en victoria para evitar reinicios accidentales.
if (document.activeElement !== btnEmpezar) btnEmpezar.focus(); // Por qué: foco en Empezar (decisión de valores por defecto).

window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && estado === 'inicio') {
    empezar(); // Por qué: Enter solo activo en 'inicio' (un solo camino de teclado).
    return;
  }
  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault(); // Por qué: Espacio no es acción de juego, solo evita el scroll (criterio 10).
    return;
  }
  // Por qué: R no se escucha a propósito (sin acción de juego, criterio 10).
  if (ARROWS.has(e.key)) {
    e.preventDefault(); // Por qué: evita que la página haga scroll con las flechas.
    pressed.add(e.key);
  }
});
window.addEventListener('keyup', (e) => {
  if (ARROWS.has(e.key)) pressed.delete(e.key);
});
window.addEventListener('blur', () => pressed.clear()); // Por qué: si se pierde el foco no queda una tecla "pegada".
// Por qué solo pagehide (sin beforeunload/visibilitychange): un solo hook cubre
// el cierre en móvil y escritorio sin duplicar eventos (spec 02, decisiones).
window.addEventListener('pagehide', () => {
  try {
    escribirGuardado();
  } catch {
    // Por qué silencio: al cerrar no hay nada que mostrar; escribirGuardado ya filtra por estado.
  }
});

// Por qué 8 direcciones: las hojas ya traen las 8 filas y así Charizard
// mira hacia donde va también en diagonal.
function dirFromKeys() {
  const dx = (pressed.has('ArrowRight') ? 1 : 0) - (pressed.has('ArrowLeft') ? 1 : 0);
  const dy = (pressed.has('ArrowDown') ? 1 : 0) - (pressed.has('ArrowUp') ? 1 : 0);
  if (dx === 0 && dy === 0) return null;
  if (dx === 0) return dy > 0 ? ['down', dx, dy] : ['up', dx, dy];
  if (dy === 0) return dx > 0 ? ['right', dx, dy] : ['left', dx, dy];
  if (dx > 0 && dy > 0) return ['downRight', dx, dy];
  if (dx > 0 && dy < 0) return ['upRight', dx, dy];
  if (dx < 0 && dy > 0) return ['downLeft', dx, dy];
  return ['upLeft', dx, dy];
}

function drawBackground(bgImg) {
  // Por qué "cover": ambos fondos son 2752x1536 (ratio 1.79) vs canvas 1.77,
  // casi idéntico; rellena sin bandas con un recorte mínimo.
  // Por qué BACKGROUNDS[fondoActual]: el paso 3 cambia directo bosque→volcán manteniendo el mismo encuadre.
  const bg = BACKGROUNDS[fondoActual];
  const s = Math.max(W / bg.sw, H / bg.sh);
  const dw = bg.sw * s;
  const dh = bg.sh * s;
  ctx.drawImage(bgImg, bg.sx, bg.sy, bg.sw, bg.sh, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function drawPortal() {
  // Por qué gating por fondo: el portal es el objetivo visible solo en el bosque;
  // en el volcán no se dibuja (criterio 4).
  if (fondoActual !== 'fondo1') return;
  ctx.save();
  // Por qué relleno tenue + borde dorado grueso: se ve al este sin ocultar el bosque ni usar assets nuevos.
  ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
  ctx.fillRect(PORTAL.x, PORTAL.y, PORTAL.w, PORTAL.h);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#FFD700';
  ctx.strokeRect(PORTAL.x, PORTAL.y, PORTAL.w, PORTAL.h);
  // Por qué etiqueta encima: en 80 px de ancho el texto no cabe dentro (decisión de valores por defecto).
  // Por qué literal exacto '→ volcán': lo fija el spec para consistencia overlay/canvas.
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#FFD700';
  ctx.fillText('→ volcán', PORTAL.x + PORTAL.w / 2, PORTAL.y - 8);
  ctx.restore();
}

// Por qué pies (shadow) en el rect: coherente con el anclado del dibujado y con la decisión del spec;
// el cambio a victoria se hace en el bucle tras mover, no aquí.
function piesEnPortal() {
  return (
    player.x >= PORTAL.x &&
    player.x <= PORTAL.x + PORTAL.w &&
    player.y >= PORTAL.y &&
    player.y <= PORTAL.y + PORTAL.h
  );
}

function drawCharizard(img, anim, dir, elapsedMs) {
  // Por qué getFrame/frameIndexAt: respetan las duraciones en ticks del XML
  // (regla 3 del README) en vez de reimplementar el temporizado.
  const i = frameIndexAt(anim, elapsedMs);
  const f = getFrame(anim, dir, i);
  // Por qué anclar por shadow (pies): evita que el sprite "salte" al
  // cambiar entre animaciones (regla 4 del README).
  const dx = player.x - f.shadow.x * SCALE;
  const dy = player.y - f.shadow.y * SCALE;
  ctx.drawImage(img, f.sx, f.sy, f.sw, f.sh, dx, dy, f.sw * SCALE, f.sh * SCALE);
}

async function main() {
  // Por qué precargar fondo2 en este paso: el cambio bosque→volcán es directo y debe mostrarse sin tirón al pisar el portal.
  const [bgBosqueImg, bgVolcanImg, walkImg, idleImg] = await Promise.all([
    loadImage(BACKGROUNDS.fondo1.src),
    loadImage(BACKGROUNDS.fondo2.src),
    loadImage(CHARIZARD.walk.src.anim),
    loadImage(CHARIZARD.idle.src.anim),
  ]);

  player.walkT0 = performance.now();
  player.idleT0 = performance.now();
  let last = performance.now();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); // Por qué tope 0.05s: un tirón no teletransporta al jugador.
    last = now;

    // Por qué gating por estado: en 'inicio' y en 'victoria' no se procesan flechas y Charizard queda en idle
    // (los overlays bloquean el juego pero el fondo + idle se siguen dibujando detrás).
    const res = estado === 'jugando' ? dirFromKeys() : null;
    const wasMoving = player.moving;
    player.moving = res !== null;
    if (player.moving) {
      const [dir, dx, dy] = res;
      player.dir = dir;
      if (!wasMoving) player.walkT0 = now; // Por qué reiniciar: evita retomar a mitad de ciclo.
      // Por qué normalizar: sin esto en diagonal iría ~41% más rápido.
      const len = Math.hypot(dx, dy);
      player.x += (dx / len) * SPEED * dt;
      player.y += (dy / len) * SPEED * dt;
      // Límites del canvas para no salirse de la pantalla.
      player.x = Math.max(0, Math.min(W, player.x));
      player.y = Math.max(0, Math.min(H, player.y));
    } else if (wasMoving) {
      player.idleT0 = now;
    }

    // Por qué detectar tras mover y solo en jugando+bosque: los pies ya están en la posición
    // final del frame y el portal solo es objetivo en fondo1; ganar() cambia a fondo2 y muestra victoria.
    if (estado === 'jugando' && fondoActual === 'fondo1' && piesEnPortal()) {
      ganar();
      player.moving = false; // Por qué: queda quieto en idle bajo el overlay de victoria.
      player.idleT0 = now;
    }

    // Por qué throttle solo en jugando y tras mover/ganar: en inicio/victoria nada
    // se mueve (victoria ya se guardó en ganar()); se actualiza lastSaveTime en cada
    // intento para serializar como máximo 1 vez/s y escribirGuardado descarta si el JSON no cambió.
    if (estado === 'jugando' && now - lastSaveTime >= SAVE_EVERY_MS) {
      lastSaveTime = now;
      escribirGuardado();
    }

    // Por qué mapa de imágenes: drawBackground elige el recorte por fondoActual pero necesita la imagen precargada.
    drawBackground(fondoActual === 'fondo1' ? bgBosqueImg : bgVolcanImg);
    const anim = player.moving ? 'walk' : 'idle';
    const img = player.moving ? walkImg : idleImg;
    const t0 = player.moving ? player.walkT0 : player.idleT0;
    drawCharizard(img, anim, player.dir, now - t0);
    // Por qué después de Charizard: el borde dorado queda siempre visible como objetivo,
    // aunque el jugador se pare encima de la franja.
    drawPortal();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main().catch((err) => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText(String(err && err.message ? err.message : err), 20, 40);
  throw err;
});
