---
description: Crea un spec con las 6 secciones
agent: build
---
## Contexto de la sesión
- Rama: !`git branch --show-current`
- Cambios: !`git status --short`

Con base en el plan acordado en esta conversación, cree specs/$ARGUMENTS.md con:
1. Objetivo (una sola frase)
2. Alcance (al menos dos elementos en "no entra"; en el spec 02, su relación con el spec 01)
3. Modelo de datos (nombres concretos)
4. Plan (pasos numerados; cada paso deja el juego funcionando)
5. Criterios de aceptación (mínimo tres, respondibles con sí o no)
6. Decisiones (tomadas y descartadas, con motivo)

No escriba código todavía: solo el spec.