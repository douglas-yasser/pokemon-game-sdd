# Spec 02 — Guardar y cargar partida (una sola ranura)

## 1. Objetivo

Conservar en `localStorage` la posición de Charizard y la fase del juego para poder continuar la partida tras cerrar o recargar el navegador.

## 2. Alcance

### Entra

- Autoguardado del progreso en `localStorage` cada 1000 ms solo si algo cambió y solo en estado `jugando`, más un guardado puntual al ganar y otro en `pagehide`.
- Botón `Continuar aventura` en la pantalla de inicio cuando hay guardado válido, que restaura posición, dirección, fondo y estado (bosque jugable o victoria tal cual).
- `Empezar aventura` como nueva partida (borra al pulsar) y `Volver a empezar` que borra el guardado; foco y `Enter` según haya o no guardado.

### No entra

- Varias ranuras o perfiles de guardado (una sola clave).
- Sonido, combate, vida, rival, objetos, niveles extra o transiciones con fundido.
- IndexedDB, cookies, `sessionStorage` o dependencias nuevas (solo `localStorage`).
- `beforeunload`, `visibilitychange` o campo `savedAt` (solo `pagehide` y objeto mínimo).
- Nuevos assets o cambios en `spritesheet.js` (solo se editan `index.html` y `game.js`).

### Relación con el spec 01

- Reutiliza los estados `inicio | jugando | victoria`, `fondoActual`, `player`, `PORTAL` y los overlays `#pantalla-inicio / #pantalla-victoria` con `.oculta` definidos en el spec 01.
- No cambia el ciclo inicio→juego→victoria→inicio ni los literales; solo añade persistencia y el botón Continuar.

## 3. Modelo de datos

Nombres que usará la implementación:

- `SAVE_KEY = 'pokemonGame.save.v1'` (clave única y versionada en `localStorage`).
- `SAVE_EVERY_MS = 1000` (throttle del autoguardado).
- Guardado: `{ v: 1, estado: 'jugando' | 'victoria', fondoActual: 'fondo1' | 'fondo2', player: { x: 0..960, y: 0..540, dir: 8 dirs } }` (sin `savedAt`).
- `lastSavedJson: string | null` y `lastSaveTime` (comparar el string JSON completo para saber si algo cambió).
- Funciones: `snapshot()`, `leerGuardado()`, `esGuardadoValido(o)`, `escribirGuardado()`, `borrarGuardado()`, `continuar()`, `nuevaPartida()`.
- DOM: `#btn-continuar` (`Continuar aventura`, con `.oculta` por defecto) junto a `#btn-empezar` en `#pantalla-inicio`.
- Reglas de foco/teclado en `inicio`: con guardado válido, foco inicial en Continuar y `Enter` → `continuar()`, `Empezar` solo por clic; sin guardado, foco en Empezar y `Enter` → nueva partida como hoy.
- Tras `continuar()` y tras nueva partida se llama `blur()` para quitar el foco del botón; `pressed` se vacía y `walkT0/idleT0` se reponen a `now`.

## 4. Plan

1. **Autoguardado verificable en DevTools:** throttle de 1000 ms solo en `jugando` con comparación de string JSON, más guardado al ganar y en `pagehide` (todo en `try/catch`); el juego queda igual pero `Application > Local Storage > pokemonGame.save.v1` muestra el JSON.
2. **Botón Continuar que restaura el bosque:** añadir `#btn-continuar`, leer y validar al arrancar, `continuar()` restaura `x/y/dir/fondo/estado='jugando'` y `nuevaPartida()` borra al pulsar; el juego funciona y Continuar devuelve al punto en el bosque.
3. **Restaurar victoria y borrados:** `continuar()` acepta también `victoria` (volcán + overlay `¡Llegaste al Volcán!`) y `volverAEmpezar()` borra el guardado; si al restaurar los pies caen en `PORTAL`, se gana al instante sin desplazar; el juego queda con el ciclo completo persistente.

## 5. Criterios de aceptación

1. ¿Tras moverme y esperar 1 s, existe `pokemonGame.save.v1` en Local Storage con mi `x`, `y` y `dir`? (sí/no)
2. ¿Si no me muevo, el valor guardado sigue igual pasado 1 s? (sí/no)
3. ¿Al tocar el portal, el valor guardado cambia a `estado: 'victoria'` y `fondoActual: 'fondo2'`? (sí/no)
4. ¿Tras recargar con una partida en curso en el bosque, la pantalla de inicio muestra `Continuar aventura` con el foco? (sí/no)
5. ¿Al pulsar `Continuar aventura` con clic, Charizard aparece en el mismo punto y dirección que al guardar? (sí/no)
6. ¿Al pulsar `Enter` con `Continuar aventura` visible, ocurre lo mismo que con el clic? (sí/no)
7. ¿Tras ganar y recargar, `Continuar aventura` devuelve al volcán con `¡Llegaste al Volcán!`? (sí/no)
8. ¿Al pulsar `Empezar aventura` con guardado, Charizard arranca abajo al centro, mirando hacia abajo, en el bosque? (sí/no)
9. ¿Tras `Volver a empezar`, `pokemonGame.save.v1` ya no existe en Local Storage? (sí/no)
10. ¿Sin guardado, o con el valor de la clave alterado a algo inválido, la pantalla de inicio no muestra `Continuar aventura`? (sí/no)

## 6. Decisiones

### Tomadas (con motivo)

- **Solo `localStorage` con clave versionada:** sobrevive a cerrar el navegador y basta para ~100 bytes sin async ni dependencias.
- **Comparar el string JSON completo:** una sola comparación detecta cualquier cambio sin campo a campo.
- **Objeto mínimo sin `savedAt`:** nada lo leía; menos bytes y menos validación.
- **Inválido/fuera de rango → descartar todo:** evita resucitar posiciones imposibles en vez de sujetar a medias.
- **Throttle solo en `jugando` + save puntual al ganar:** en `victoria` nada se mueve; el save de `ganar()` ya persiste.
- **Solo `pagehide` (sin `beforeunload`/`visibilitychange`):** un solo hook cubre el cierre sin duplicar eventos.
- **Restaurar en portal → ganar al instante:** coherente con "pies en `PORTAL` ganan", sin excepción de 1 px.
- **`blur()` tras Continuar/Nueva y `Enter`=Continuar con guardado:** evita re-disparos del botón y un solo camino de teclado según contexto.
- **Borrar al pulsar Nueva y al Volver:** evita que la partida vieja resucite tras reset.

### Descartadas (con motivo)

- **IndexedDB/cookies/multiranura:** sobredimensionado para una sola partida; añade async y complejidad sin aportar objetivo.
- **`beforeunload`/`visibilitychange` extra:** duplican el cierre; `pagehide` ya cubre móvil y escritorio.
- **Guardar `pressed/moving/relojes` o `savedAt`:** son transitorios o no leídos; se reponen a `now` al cargar.
- **Sujetar `x/y` a bordes en vez de descartar:** ocultaría corrupción; descartar arranca limpio como hoy.
- **Desplazar 1 px fuera del portal al restaurar:** metería excepción ad hoc contra la regla de pies en portal.
