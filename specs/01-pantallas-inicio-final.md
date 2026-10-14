# Spec 01 — Pantallas de inicio y final (bosque → volcán)

## 1. Objetivo

Dar a Charizard un inicio con pantalla previa, un objetivo visible que lo lleve del bosque al volcán y una pantalla de victoria con opción de volver a empezar.

## 2. Alcance

### Entra

- Pantalla de inicio que bloquea el juego hasta pulsar `Empezar aventura` (clic o `Enter`).
- Objetivo visible en el bosque: franja portal de 80×240 en el borde derecho con borde dorado y texto `→ volcán`.
- Cambio directo de fondo `fondo1` (bosque) a `fondo2` (volcán) al tocar el portal.
- Pantalla de victoria con literal `¡Llegaste al Volcán!` y botón `Volver a empezar` (solo ratón) que regresa a la pantalla de inicio con estado reseteado, además del botón `Volver al menú` (`#btn-menu`) que vuelve a inicio.
- Reset al reiniciar: posición `(480, 400)`, dirección `'down'`, fondo `'fondo1'`, teclas vaciadas.

### No entra

- Guardar/cargar partida ni persistencia alguna.
- Sonido, combate, vida, rival, objetos recolectables o niveles extra.
- Teclas `R` y `Espacio` como acciones de juego (no hacen nada de juego; `Espacio` solo se bloquea para no hacer scroll).
- Transición con fundido/crossfade entre fondos (el cambio es directo).
- Nuevos assets, dependencias o archivos de código (solo se editan `index.html` y `game.js`).

### Relación con el spec 02

- El spec 02 será "Guardar y cargar partida" y depende de los estados `inicio` / `jugando` / `victoria` definidos en este spec.

## 3. Modelo de datos

Nombres que usará la implementación:

- `estado`: `'inicio' | 'jugando' | 'victoria'`. Valor al cargar: `'inicio'`.
- `fondoActual`: `'fondo1' | 'fondo2'`. Valor al cargar y al resetear: `'fondo1'`.
- `PORTAL`: `{ x: 880, y: 150, w: 80, h: 240 }` (derivado de `W=960, H=540`: `960-80=880`, `(540-240)/2=150`).
- `player`: `{ x: 480, y: 400, dir: 'down', moving: false, walkT0, idleT0 }` (los relojes se reponen en cada reset).
- `pressed`: `Set` de flechas pulsadas; se vacía al cargar, al empezar, al ganar y al volver.
- Capas DOM: `#escena` (contenedor relativo), `#pantalla-inicio.pantalla`, `#pantalla-victoria.pantalla.oculta`, botones `#btn-empezar`, `#btn-reiniciar` y `#btn-menu`.
- Clase CSS `.oculta { display: none; }` como único mecanismo de ocultar pantallas (no atributo `hidden`).

## 4. Plan

1. **Pantalla de inicio:** overlay en `index.html` (`#escena`, `#pantalla-inicio` visible, `#pantalla-victoria.oculta`, CSS `.pantalla` / `.oculta`), estado `estado='inicio'` que dibuja el bosque con Charizard en `idle` sin procesar flechas, y botón `Empezar aventura` (clic o `Enter` solo en `inicio`) que pasa a `jugando`. Efecto visible: al abrir hay inicio que bloquea; al pulsar Empezar se juega y se camina en 8 direcciones.
2. **Portal visible en el bosque, sin colisión todavía:** dibujar en el canvas el rect `PORTAL={880,150,80,240}` con borde dorado y texto `→ volcán` solo cuando el fondo es bosque. Efecto visible: el objetivo se ve al este durante el juego, pero tocarlo aún no hace nada.
3. **Victoria y reinicio:** detectar la entrada de los pies (`shadow`) en `PORTAL` para cambiar a `fondo2` (precargado en este paso) y mostrar la pantalla de victoria con `¡Llegaste al Volcán!`; el botón `Volver a empezar` (solo clic) aplica reset completo (`480,400,'down',fondo1`, teclas vaciadas, relojes repuestos) y vuelve a `inicio`. Efecto visible: tocar el portal muestra el volcán con victoria, y Volver deja el juego de nuevo en inicio listo para repetir el ciclo. Nota: el botón `Volver al menú` (`#btn-menu`), que vuelve a inicio, fue añadido por el spec 02.

## 5. Criterios de aceptación


1. ¿Al abrir la página se ve la pantalla de inicio y las flechas no mueven a Charizard? (sí/no)
2. ¿Al pulsar `Empezar aventura` con clic, Charizard se mueve en 8 direcciones con las flechas? (sí/no)
3. ¿Al pulsar `Enter` en la pantalla de inicio ocurre lo mismo que con el clic? (sí/no)
4. ¿El portal dorado con `→ volcán` se ve en el bosque y no se ve en el volcán? (sí/no)
5. ¿Al tocar el portal el fondo cambia a volcán y aparece `¡Llegaste al Volcán!` con el botón `Volver a empezar`? (sí/no)
6. ¿En la pantalla de victoria Charizard no se mueve al pulsar las flechas? (sí/no)
7. ¿Al pulsar `Volver a empezar` se ve de nuevo la pantalla de inicio sobre el bosque? (sí/no)
8. ¿Tras volver a empezar y pulsar `Empezar aventura`, Charizard aparece abajo al centro, mirando hacia abajo y quieto hasta que se pulsa una flecha? (sí/no)
9. ¿La pantalla de victoria no se ve al abrir la página ni durante el juego? (sí/no)
10. ¿Pulsar `R` o `Espacio` durante el juego no cambia el estado del juego, y `Espacio` no hace scroll? (sí/no)

## 6. Decisiones

### Tomadas (con motivo)

- **Overlays HTML en vez de dibujar en canvas:** los botones son clicables y accesibles sin implementar hit-test manual.
- **Reinicio vuelve a `inicio`, no directo a jugar:** mantiene el ciclo inicio→juego→victoria→inicio y exige pulsar Empezar de nuevo.
- **Solo ratón + `Enter` para empezar; `R`/`Espacio` sin acción de juego:** deja un solo camino de teclado para empezar; `Espacio` solo evita el scroll para no mover la página.
- **`Enter` ignorado en victoria:** evita reinicios accidentales; el retorno es solo con clic.
- **Portal fijo 80×240 en `{880,150}` con borde dorado:** no requiere nuevos assets y se detecta con los pies (`shadow`), coherente con el dibujado actual.
- **Cambio directo bosque→volcán:** ambos fondos miden `2752×1536` con el mismo encuadre, así que el cambio directo mantiene la escena estable.
- **Ocultar con `.oculta{display:none}`:** la clase es explícita y no depende del atributo `hidden`, que se anula cuando la capa usa `display:flex` para centrar.
- **Sin archivos ni dependencias nuevas:** bastan `index.html` y `game.js` para este alcance.
- **Literales fijados:** `Empezar aventura / ¡Llegaste al Volcán! / Volver a empezar / → volcán` para mantener consistencia entre overlay y canvas.
- **Valores por defecto para lo abierto:** foco en `Empezar` y `Enter` activo solo en el estado `inicio`, `idle` animado tras overlay semitransparente, etiqueta encima del rect (no cabe en 80 px).

### Descartadas (con motivo)

- **Recoger objeto antes de salir:** añade pasos y estados; el portal simple ya da un objetivo visible.
- **Fundido bosque→volcán:** añade doble dibujado con `globalAlpha` sin aportar objetivo; el cambio directo es suficiente.
- **Todo en canvas:** descartado por el coste de botones manuales y peor accesibilidad.
- **Reinicio directo a `jugando`:** descartado para mantener el retorno a `inicio`.
- **Atajo `R` o `Espacio` para (re)empezar:** descartado para dejar un solo camino de teclado en el inicio.
- **Guardar partida:** queda asignado al spec 02 "Guardar y cargar partida".
- **Sonido, combate, vida, rival, objetos recolectables, niveles extra, fundido y nuevos assets/dependencias:** quedan fuera de alcance sin spec asignado.
