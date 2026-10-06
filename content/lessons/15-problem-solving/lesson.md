---
title: Estrategia para resolver problemas en vivo
order: 15
summary: Un método propio para ir del enunciado al código funcionando mientras piensas en voz alta, más un plan de estudio semanal.
tags: [estrategia, resolución de problemas, comunicación, patrones, plan de estudio]
---

## El objetivo real de la entrevista de algoritmos

El entrevistador no sólo quiere la respuesta; quiere **ver cómo piensas**. Un candidato que llega a una buena solución explicando cada decisión suele puntuar mejor que uno que escribe en silencio la solución perfecta. Esta lección propone un método en cinco fases que puedes practicar con cada ejercicio de la plataforma.

## Fase 1 — Entender (≈ 3 min)

- **Reformula el problema** en tus palabras y confirma que coincide con lo que pidieron.
- **Pregunta por las restricciones:** ¿qué tamaño tiene la entrada? ¿Puede estar vacía? ¿Hay negativos o duplicados? ¿Está ordenada? ¿Qué devuelvo si no hay respuesta?
- **Toma nota** de cada dato del enunciado: si mencionaron que el arreglo está ordenado, casi seguro importa.

> El tamaño de la entrada es una pista enorme. Con n ≤ 20 suele esperarse algo exponencial (backtracking, máscaras de bits); con n ≈ 10⁵, algo O(n log n) o mejor; con n ≈ 10⁹, O(log n) o una fórmula.

## Fase 2 — Ejemplos (≈ 3 min)

Construye **tu propio ejemplo**, de tamaño mediano y sin simetrías engañosas. Un ejemplo demasiado pequeño o "bonito" (todo ordenado, todos distintos) esconde casos importantes. Resuélvelo **a mano**: el procedimiento que sigues intuitivamente muchas veces ya es el algoritmo.

## Fase 3 — Plan (≈ 10 min)

1. **Enuncia una solución directa**, aunque sea lenta, con su complejidad. Te asegura algo que entregar y sirve de punto de partida.
2. **Mejórala** con preguntas guía:
   - ¿Estoy **recalculando** algo que podría guardar (hash, prefijos, memoización)?
   - ¿Hay una **estructura** que responda la pregunta del ciclo interno en O(1) o O(log n)?
   - ¿Ayuda **ordenar** primero?
   - ¿El problema es sobre un **bloque contiguo**? → ventana deslizante.
   - ¿Puedo pensar en él como un **grafo** o un **árbol**?
   - ¿Se puede **dividir** en mitades o subproblemas más pequeños?
   - ¿Cuál es lo **mínimo** que tendría que hacer cualquier solución? Si hay que leer toda la entrada, no bajarás de O(n); si ya estás ahí, deja de optimizar el tiempo.
3. **Acuerda el plan** con el entrevistador antes de programar: "Voy a usar un mapa de frecuencias y una ventana; sería O(n) en tiempo y O(k) en espacio. ¿Te parece bien que lo implemente?"

## Fase 4 — Código (≈ 15–20 min)

- Escribe código **limpio y modular**: una función auxiliar con buen nombre (`esValido`, `vecinos`) vale más que un bloque gigante.
- Usa nombres descriptivos; en la entrevista, legibilidad > brevedad.
- Si una parte es trivial pero larga, dilo y déjala para el final: "Aquí asumo una función que parsea la entrada; la escribo al final si hay tiempo".
- Sigue **narrando** lo que haces, sin dejar de escribir.

## Fase 5 — Verificar (≈ 5 min)

- Relee el código buscando errores comunes (bordes de ciclos, `<` vs `<=`, variables sin actualizar).
- Ejecuta a mano un ejemplo pequeño.
- Revisa casos borde (lección 12).
- Si encuentras un error, **corrígelo con calma** explicando la causa; es una oportunidad, no un fracaso.
- Cierra con la complejidad final de tiempo y espacio.

## Tabla de reconocimiento de patrones

| Si el enunciado dice… | Considera… |
|---|---|
| "subarreglo / substring contiguo" | ventana deslizante, prefijos |
| "arreglo ordenado", "encontrar en O(log n)" | búsqueda binaria, dos punteros |
| "todas las combinaciones / permutaciones" | backtracking |
| "número de formas", "máximo/mínimo con elecciones" | programación dinámica |
| "camino más corto", "mínimo número de pasos" | BFS |
| "conectado", "grupos", "islas" | DFS/BFS, union-find |
| "los k mayores/menores/más frecuentes" | heap, bucket sort, quickselect |
| "siguiente mayor/menor", "paréntesis" | pila (monótona) |
| "prefijos de palabras" | trie |
| "dependencias", "orden de tareas" | ordenamiento topológico |
| "intervalos" | ordenar por inicio |

## Si te atoras

- **Dilo en voz alta** y resume lo que ya sabes: "Tengo O(n²) y creo que el cuello está en esta búsqueda".
- Vuelve al ejemplo y resuélvelo a mano de nuevo, prestando atención a **cómo** lo haces.
- Prueba una simplificación: ¿y si el arreglo estuviera ordenado? ¿y si sólo hubiera dos elementos? ¿y si k = 1?
- Acepta pistas con naturalidad; usarlas bien también cuenta.

## Plan de estudio sugerido (8 semanas)

| Semana | Tema en la plataforma | Meta |
|---|---|---|
| 1 | Big O, arreglos, strings, hash | Todos los ejercicios de las lecciones 1–2 |
| 2 | Listas enlazadas, pilas y colas | Lecciones 3–4 + repaso diario |
| 3 | Árboles y grafos | Lección 5; implementar BFS/DFS de memoria |
| 4 | Recursión y DP | Lección 9; resolver cada problema dos veces (memo y tabla) |
| 5 | Ordenamiento, búsqueda, bits, matemáticas | Lecciones 6, 7 y 11 |
| 6 | Diseño OO y de sistemas | Lecciones 8 y 10; practicar explicando en voz alta |
| 7 | Pruebas, concurrencia, conductual | Lecciones 12–14; escribir 6 historias STAR |
| 8 | Simulacros | Resolver problemas con temporizador de 45 min y explicar en voz alta |

Todos los días: 10–15 minutos en **Repasar** para mantener frescas las tarjetas.
