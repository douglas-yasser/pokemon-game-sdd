# Spec 02 — Guardar y cargar partida (guardado manual, tres ranuras)

## 1. Objetivo

Conservar en `localStorage` hasta 3 partidas manuales (posición de Charizard, fase del juego y fecha) que solo se escriben con el botón `Guardar`, para poder verlas en el inicio y continuar la ranura elegida tras cerrar o recargar el navegador.

## 2. Alcance

### Entra

- Guardado manual con el botón `Guardar`, visible en `jugando` y en `victoria`: abre un selector de 3 ranuras y confirma con el literal `Partida N guardada`. Solo este botón escribe en `localStorage`.
- Lista de partidas en la pantalla de inicio con una fila por ranura: fecha (`savedAt`), zona (`Bosque`/`Volcán`) y un botón `Continuar` por ranura. Las vacías dicen `Vacía`. Una ranura alterada se muestra como vacía.
- `Continuar` por ranura, que restaura posición, dirección, fondo y estado (bosque jugable o victoria tal cual).
- `Empezar aventura` solo inicia una partida nueva (`480,400,'down',fondo1` → `jugando`) y no toca ninguna ranura. No hay modal de sobrescribir.
- `Volver al menú` en el HUD (`jugando`) y en la victoria (modifica el overlay `#pantalla-victoria` del spec 01): vuelve a `inicio` sin preguntar, sin guardar y sin borrar. Foco y `Enter` según haya o no ranuras válidas.

### No entra

- Borrar partidas: no hay botón ni acción de borrado (tampoco al empezar, al ganar ni al volver).
- Autoguardado, guardado en `pagehide`, `beforeunload`, `visibilitychange` o guardado puntual al ganar.
- Teclas `G`/`Esc` para guardar o volver (solo botones `Guardar` y `Volver al menú` en el HUD).
- Migración de la clave vieja `pokemonGame.save.v1`: se ignora.
- Modal de sobrescribir al empezar con ranuras llenas.
- Sonido, combate, vida, rival, objetos, niveles extra o transiciones con fundido.
- IndexedDB, cookies, `sessionStorage` o dependencias nuevas (solo `localStorage`).
- Nuevos assets o cambios en `spritesheet.js` (solo se editan `index.html` y `game.js`). No se tocan `PORTAL` ni los fondos.

### Relación con el spec 01

- Reutiliza los estados `inicio | jugando | victoria`, `fondoActual`, `player`, `PORTAL` y los overlays `#pantalla-inicio / #pantalla-victoria` con `.oculta` definidos en el spec 01.
- Añade "Volver al menú" a #pantalla-victoria y un HUD en jugando; el ciclo inicio→juego→victoria→inicio y los literales no cambian.

## 3. Modelo de datos

Nombres que usará la implementación:

- `SAVE_SLOT_PREFIX = 'pokemonGame.save.v1.slot'` (+ `1..3`) y `NUM_RANURAS = 3` en `localStorage`. Por qué prefijo por ranura: reutiliza la validación por ranura y un slot corrupto no invalida los otros.
- La clave vieja `pokemonGame.save.v1` se ignora (sin migración). Por qué: migrarla copiaría una partida a la ranura 1 sin que el jugador lo pidiera.
- Guardado por ranura: `{ v: 1, estado: 'jugando' | 'victoria', fondoActual: 'fondo1' | 'fondo2', player: { x: 0..960, y: 0..540, dir: 8 dirs }, savedAt: timestamp }`. Por qué se añade `savedAt`: la lista necesita la fecha; antes se descartó porque nada lo leía.
- El paso 4 elimina `SAVE_KEY`, `SAVE_EVERY_MS`, `lastSavedJson`/`lastSaveTime` y `borrarGuardado()`. Por qué: eran el autoguardado y el borrado; el único punto de escritura pasa a ser el botón `Guardar`.
- Funciones: `snapshot()` (añade `savedAt: Date.now()`), `leerRanura(i)`, `guardarEnRanura(i)`, `listarRanuras()`, `esGuardadoValido(o)` (igual que en pasos 1–3, con `savedAt` opcional: si falta o no es número la ranura sigue válida pero muestra "sin fecha"), `continuarDesde(i)`, `nuevaPartida()` (solo resetea, no toca ranuras).
- DOM: `#btn-guardar` y `#btn-menu` en el HUD (visibles en `jugando` y en `victoria`), selector de 3 ranuras + `#msg-guardado` (`Partida N guardada`), y `#lista-partidas` en `#pantalla-inicio` (una fila por ranura con fecha + `Bosque`/`Volcán` + `Continuar`; `Vacía` con botón deshabilitado).
- Reglas de foco/teclado en `inicio`: con al menos una ranura válida, foco inicial en el primer `Continuar` y `Enter` → ese `continuarDesde(i)`; sin ranuras válidas, foco en Empezar y `Enter` → nueva partida.
- Tras `continuarDesde(i)` y tras nueva partida se llama `blur()` para quitar el foco del botón; `pressed` se vacía y `walkT0/idleT0` se reponen a `now`.

## 4. Plan

1. **Autoguardado verificable en DevTools:** throttle de 1000 ms solo en `jugando` con comparación de string JSON, más guardado al ganar y en `pagehide` (todo en `try/catch`); el juego queda igual pero `Application > Local Storage > pokemonGame.save.v1` muestra el JSON.
2. **Botón Continuar que restaura el bosque:** añadir `#btn-continuar`, leer y validar al arrancar, `continuar()` restaura `x/y/dir/fondo/estado='jugando'` y `nuevaPartida()` borra al pulsar; el juego funciona y Continuar devuelve al punto en el bosque.
3. **Restaurar victoria y borrados:** `continuar()` acepta también `victoria` (volcán + overlay `¡Llegaste al Volcán!`) y `volverAEmpezar()` borra el guardado; si al restaurar los pies caen en `PORTAL`, se gana al instante sin desplazar; el juego queda con el ciclo completo persistente.
4. **Botón Guardar con ranuras y sin autoguardado (deja el juego funcionando):** quitar throttle del `frame()`, guardado en `ganar()`, listener `pagehide` y llamadas a `borrarGuardado()`; añadir `SAVE_SLOT_PREFIX`, `guardarEnRanura(i)` y HUD con `#btn-guardar` + selector de 3 ranuras + `#msg-guardado` (`Partida N guardada`); `nuevaPartida()` ya no toca ranuras. Efecto: se juega bosque→volcán igual, moverse sin guardar no crea `slotN`, y guardar crea `...slotN` con `x/y/dir/fondo/savedAt`. Se verifica en DevTools → Application → Local Storage, porque aún no hay lista de partidas.
5. **Lista de partidas en inicio con Continuar por ranura (deja el juego funcionando):** añadir `#lista-partidas` con 3 filas (fecha + `Bosque`/`Volcán` + `Continuar`, o `Vacía` deshabilitada), `listarRanuras()` + `continuarDesde(i)` + refresco al entrar en `inicio`; `Enter` enfoca el primer Continuar disponible o Empezar si todo vacío. Efecto: recargar muestra las 3 ranuras y cada Continuar devuelve a su punto exacto.
6. **Botón Volver al menú, también desde la victoria (deja el juego funcionando):** `#btn-menu` en el HUD (`jugando`) y en `#pantalla-victoria`; vuelve a `inicio` (inicio limpio en `fondo1/480,400/down`, lista refrescada) sin preguntar, sin guardar y sin borrar. Efecto: salir a mitad del bosque o desde victoria no escribe ni borra nada.

Nota: los pasos 1 a 3 ya están hechos y no se reescriben; los pasos 4 a 6 sustituyen su comportamiento (ya no hay autoguardado ni borrado).

## 5. Criterios de aceptación

Nota: los criterios 1, 2, 3 y 9 originales (autoguardado al mover/ganar y borrado al volver) quedan sustituidos por los criterios 1, 2, 3, 9 y 11 de esta lista.

1. ¿Moverme y esperar 2 s sin pulsar Guardar no crea ni cambia ningún `pokemonGame.save.v1.slotN`? (sí/no)
2. ¿Al tocar el portal (ganar) ningún `slotN` cambia hasta que pulso Guardar? (sí/no)
3. ¿Cerrar/recargar a mitad del juego no guarda nada solo? (sí/no)
4. ¿Pulsar `Guardar` + Ranura N crea `pokemonGame.save.v1.slotN` con mi `x`, `y`, `dir`, fondo y fecha? (sí/no)
5. ¿Tras guardar se lee el literal `Partida N guardada`? (sí/no)
6. ¿La lista en inicio muestra por ranura fecha + `Bosque`/`Volcán` + `Continuar`, o `Vacía` si está vacía? (sí/no)
7. ¿Una ranura alterada a algo inválido se muestra como `Vacía` y su `Continuar` no hace nada? (sí/no)
8. ¿Al pulsar `Continuar` de una ranura, Charizard aparece en el mismo punto, dirección y fondo que al guardar (incluido volcán con `¡Llegaste al Volcán!`)? (sí/no)
9. ¿Al pulsar `Empezar aventura`, Charizard arranca abajo al centro, mirando hacia abajo, en el bosque, sin modificar ninguna ranura? (sí/no)
10. ¿`Volver al menú` (desde el juego y desde la victoria) vuelve al inicio sin guardar ni borrar nada? (sí/no)
11. ¿No existe ningún botón ni acción que borre partidas? (sí/no)
12. ¿Portal, fondos y Charizard se ven igual que antes (sin cambios de escena)? (sí/no)

## 6. Decisiones

### Tomadas (con motivo)

Pasos 1–3 (histórico, comportamiento sustituido por los pasos 4–6):

- **Solo `localStorage` con clave versionada:** sobrevive a cerrar el navegador y basta para ~100 bytes sin async ni dependencias.
- **Comparar el string JSON completo:** una sola comparación detecta cualquier cambio sin campo a campo.
- **Objeto mínimo sin `savedAt`:** nada lo leía; menos bytes y menos validación.
- **Inválido/fuera de rango → descartar todo:** evita resucitar posiciones imposibles en vez de sujetar a medias.
- **Throttle solo en `jugando` + save puntual al ganar:** en `victoria` nada se mueve; el save de `ganar()` ya persiste.
- **Solo `pagehide` (sin `beforeunload`/`visibilitychange`):** un solo hook cubre el cierre sin duplicar eventos.
- **Restaurar en portal → ganar al instante:** coherente con "pies en `PORTAL` ganan", sin excepción de 1 px.
- **`blur()` tras Continuar/Nueva y `Enter`=Continuar con guardado:** evita re-disparos del botón y un solo camino de teclado según contexto.
- **Borrar al pulsar Nueva y al Volver:** evita que la partida vieja resucite tras reset.

Pasos 4–6 (guardado manual, vigente):

- **Solo el botón `Guardar` escribe:** por qué — si quedara cualquier autoguardado, "el jugador decide cuándo guardar" sería falso.
- **Tres ranuras con prefijo por ranura:** por qué — una ranura corrupta no invalida las otras y se reutiliza la validación estricta del paso 1–3.
- **Añadir `savedAt`:** por qué — la lista necesita la fecha; se valida como opcional para no invalidar por un campo de muestra.
- **`Empezar` no toca ranuras:** por qué — tocarlas al empezar sería un borrado encubierto.
- **`Volver al menú` sin preguntar ni guardar:** por qué — mantiene "guardar solo con Guardar" puro, sin guardados ocultos al salir.
- **`Guardar` visible en `jugando` y en `victoria`:** por qué — la victoria también es una partida que el jugador puede querer conservar, y antes se guardaba sola al ganar.
- **Al volver al menú se repone fondo1/480,400/down:** por qué — el inicio se dibuja siempre igual y no se queda mostrando el volcán.
- **Ranura alterada → se muestra `Vacía`:** por qué — misma regla "inválido → descartar todo", evita resucitar corrupción.

### Descartadas (con motivo)

Pasos 1–3 (histórico):

- **IndexedDB/cookies/multiranura:** sobredimensionado para una sola partida; añade async y complejidad sin aportar objetivo.
- **`beforeunload`/`visibilitychange` extra:** duplican el cierre; `pagehide` ya cubre móvil y escritorio.
- **Guardar `pressed/moving/relojes` o `savedAt`:** son transitorios o no leídos; se reponen a `now` al cargar.
- **Sujetar `x/y` a bordes en vez de descartar:** ocultaría corrupción; descartar arranca limpio como hoy.
- **Desplazar 1 px fuera del portal al restaurar:** metería excepción ad hoc contra la regla de pies en portal.

Pasos 4–6 (guardado manual):

- **Borrar partidas:** por qué — fuera de alcance por decisión explícita; no hay botón ni acción de borrado.
- **Teclas `G`/`Esc`:** por qué — evitan choques con `Enter`/`Espacio`/flechas ya fijados y reducen focos accidentales; bastan los botones.
- **Modal de sobrescribir al empezar:** por qué — `Empezar` solo inicia; sobrescribir ocurre solo al elegir ranura en `Guardar`.
- **Migración de `pokemonGame.save.v1`:** por qué — copiaría una partida vieja a la ranura 1 sin permiso del jugador.
- **Cambios de escena (`PORTAL`, fondos, `spritesheet.js`):** por qué — fuera de alcance; el cambio es solo persistencia y UI con `index.html` + `game.js`.
