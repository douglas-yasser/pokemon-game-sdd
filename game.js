import { BACKGROUNDS, CHARIZARD, getFrame, frameIndexAt } from './spritesheet.js';

// Por qué estas constantes: W/H fijan el canvas acordado (960x540),
// SCALE=2 duplica el sprite de 56x72 a 112x144 para que se aprecie,
// SPEED=220 px/s da un caminar visible (~3.6 px/frame a 60fps).
const W = 960;
const H = 540;
const SCALE = 2;
const SPEED = 220;

// Por qué prefijo por ranura: tres ranuras manuales en localStorage; una ranura
// corrupta no invalida las otras y se reutiliza la validación estricta (spec 02, paso 4).
// La clave vieja `pokemonGame.save.v1` se ignora sin migración.
const SAVE_SLOT_PREFIX = 'pokemonGame.save.v1.slot';
// Por qué 3: número de ranuras fijado por el spec.
const NUM_RANURAS = 3;

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

// Por qué snapshot con savedAt: la lista del paso 5 necesita la fecha; se genera
// aquí con Date.now() para que cada escritura manual quede fechada (spec 02, modelo).
function snapshot() {
  return {
    v: 1,
    estado,
    fondoActual,
    player: { x: player.x, y: player.y, dir: player.dir },
    savedAt: Date.now(),
  };
}

// Por qué guardarEnRanura es el único punto de escritura: si quedara cualquier
// autoguardado, "el jugador decide cuándo guardar" sería falso (spec 02, paso 4).
// Solo guarda en jugando/victoria y traga errores de localStorage para no romper el juego.
function guardarEnRanura(i) {
  if (!Number.isInteger(i) || i < 1 || i > NUM_RANURAS) return false;
  if (estado !== 'jugando' && estado !== 'victoria') return false;
  try {
    localStorage.setItem(SAVE_SLOT_PREFIX + i, JSON.stringify(snapshot()));
    return true;
  } catch {
    // Por qué silencio: el juego debe seguir igual aunque no se pueda guardar.
    return false;
  }
}

// Por qué Set de 8 dirs: valida que dir sea una de las filas reales de la hoja
// (misma lista que DIRECTIONS); cualquier otro string es corrupción y se descarta.
const DIRS_VALIDAS = new Set([
  'down',
  'downRight',
  'right',
  'upRight',
  'up',
  'upLeft',
  'left',
  'downLeft',
]);

// Por qué leerRanura devuelve null ante cualquier fallo: clave ausente, JSON roto,
// índice fuera de rango o localStorage bloqueado equivalen a "ranura vacía".
// Existe ya en el paso 4 aunque la lista llegue en el paso 5: permite verificar
// en DevTools y reutiliza la validación por ranura.
function leerRanura(i) {
  if (!Number.isInteger(i) || i < 1 || i > NUM_RANURAS) return null;
  try {
    const raw = localStorage.getItem(SAVE_SLOT_PREFIX + i);
    if (raw == null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Por qué validación estricta con descarte total: evita resucitar posiciones
// imposibles sujetando a medias (spec 02, decisiones). Se acepta 'jugando' y
// 'victoria'; cualquier otro estado es corrupción y se descarta.
// Por qué savedAt opcional: si falta o no es número la ranura sigue válida
// (el paso 5 mostrará "sin fecha"); nunca invalida por la fecha.
function esGuardadoValido(o) {
  if (o == null || typeof o !== 'object') return false;
  if (o.v !== 1) return false;
  if (o.estado !== 'jugando' && o.estado !== 'victoria') return false;
  if (o.fondoActual !== 'fondo1' && o.fondoActual !== 'fondo2') return false;
  const p = o.player;
  if (p == null || typeof p !== 'object') return false;
  if (typeof p.x !== 'number' || !Number.isFinite(p.x) || p.x < 0 || p.x > W) return false;
  if (typeof p.y !== 'number' || !Number.isFinite(p.y) || p.y < 0 || p.y > H) return false;
  if (!DIRS_VALIDAS.has(p.dir)) return false;
  return true;
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
const hud = document.getElementById('hud');
const btnGuardar = document.getElementById('btn-guardar');
const msgGuardado = document.getElementById('msg-guardado');

// Por qué nuevaPartida no toca ranuras: tocarlas al empezar sería un borrado
// encubierto (spec 02, paso 4). Solo resetea al inicio del bosque y muestra el HUD.
function nuevaPartida() {
  if (estado !== 'inicio') return;
  estado = 'jugando';
  fondoActual = 'fondo1';
  player.x = 480;
  player.y = 400;
  player.dir = 'down';
  player.moving = false;
  const ahora = performance.now();
  player.walkT0 = ahora; // Por qué reponer: evita retomar a mitad de ciclo.
  player.idleT0 = ahora;
  pressed.clear(); // Por qué: evita que una flecha pulsada tras el overlay mueva de golpe.
  pantallaInicio.classList.add('oculta');
  hud.classList.remove('oculta');
  msgGuardado.textContent = '';
  btnEmpezar.blur(); // Por qué blur: evita re-disparos del botón con Espacio/Enter (modelo de datos).
}

// Por qué ganar: centraliza el paso jugando→victoria al pisar el portal con los pies
// (player.x/y son el punto shadow), cambia directo a fondo2, vacía teclas y muestra el overlay.
// Por qué sin guardar aquí: el paso 4 quita el guardado puntual al ganar; solo el
// botón Guardar escribe (criterio 2: ganar no cambia ningún slotN hasta pulsar Guardar).
function ganar() {
  if (estado !== 'jugando') return;
  estado = 'victoria';
  fondoActual = 'fondo2'; // Por qué directo: el spec descarta fundido; ambos fondos miden 2752×1536 con el mismo encuadre.
  pressed.clear(); // Por qué: al ganar se vacía (modelo de datos) para no arrastrar flechas.
  pantallaVictoria.classList.remove('oculta');
}

// Por qué volverAEmpezar: aplica el reset completo del spec (480,400,'down',fondo1,
// teclas vaciadas, relojes repuestos) y vuelve a 'inicio' para repetir el ciclo inicio→juego→victoria→inicio.
// Por qué sin borrar ni guardar: el paso 4 elimina el borrado; volver no escribe
// ni borra ranuras y deja el inicio limpio con foco en Empezar. El HUD se oculta.
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
  hud.classList.add('oculta');
  msgGuardado.textContent = '';
  pantallaInicio.classList.remove('oculta');
  if (document.activeElement !== btnEmpezar) btnEmpezar.focus(); // Por qué: deja el foco listo para el siguiente Enter.
}

// Por qué ranuraSeleccionada: el selector del HUD fija dónde escribe Guardar;
// por defecto 1 y se valida a 1..NUM_RANURAS para no escribir claves arbitrarias.
function ranuraSeleccionada() {
  const checked = document.querySelector('input[name="ranura"]:checked');
  const n = checked ? Number.parseInt(checked.value, 10) : 1;
  if (!Number.isInteger(n) || n < 1 || n > NUM_RANURAS) return 1;
  return n;
}

// Por qué este handler: es el único punto de escritura del juego (paso 4).
// Guarda x/y/dir/fondo/savedAt en `SAVE_SLOT_PREFIX + N` y confirma con el
// literal exacto `Partida N guardada` (criterios 4 y 5).
function alPulsarGuardar() {
  if (estado !== 'jugando' && estado !== 'victoria') return;
  const n = ranuraSeleccionada();
  if (guardarEnRanura(n)) {
    msgGuardado.textContent = `Partida ${n} guardada`;
  }
  btnGuardar.blur(); // Por qué blur: evita re-disparos con Espacio/Enter.
}

btnEmpezar.addEventListener('click', nuevaPartida);
btnReiniciar.addEventListener('click', volverAEmpezar); // Por qué solo clic: Enter se ignora en victoria para evitar reinicios accidentales.
btnGuardar.addEventListener('click', alPulsarGuardar);
// Por qué foco inicial siempre en Empezar: el paso 4 aún no tiene lista de
// partidas (llega en el paso 5); Enter en inicio es siempre nueva partida.
if (document.activeElement !== btnEmpezar) btnEmpezar.focus();

window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && estado === 'inicio') {
    // Por qué siempre nueva partida: el paso 4 aún no tiene Continuar por ranura
    // (llega en el paso 5); Empezar no toca ranuras.
    nuevaPartida();
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
// Por qué sin pagehide/beforeunload/visibilitychange: el paso 4 elimina el
// autoguardado al cerrar; cerrar/recargar no guarda nada solo (criterio 3).

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

    // Por qué sin throttle aquí: el paso 4 quita el autoguardado del frame();
    // moverse sin pulsar Guardar no crea ni cambia ningún slotN (criterio 1).

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
