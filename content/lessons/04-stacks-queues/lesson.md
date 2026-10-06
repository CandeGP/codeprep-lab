---
title: Pilas y colas
order: 4
summary: LIFO y FIFO, cuándo reconocer que un problema "huele" a pila o a cola, y el patrón de pila monótona.
tags: [stack, queue, deque, pila monótona, LIFO, FIFO]
---

## Dos disciplinas de acceso

- **Pila (stack) — LIFO:** el último en entrar es el primero en salir. Piensa en una torre de platos: sólo tomas el de arriba.
- **Cola (queue) — FIFO:** el primero en entrar es el primero en salir. Como la fila del supermercado.

Ambas ofrecen sus operaciones principales en **O(1)**.

| Operación | Pila | Cola |
|---|---|---|
| Insertar | `push` (arriba) | `enqueue` (al final) |
| Quitar | `pop` (arriba) | `dequeue` (del frente) |
| Consultar sin quitar | `peek` / `top` | `peek` / `front` |

## En código

```js
// Pila: un arreglo basta (push/pop al final son O(1))
const pila = [];
pila.push(1); pila.push(2);
pila.pop();        // 2
pila.at(-1);       // 1  (peek)

// Cola: ¡cuidado! arr.shift() es O(n) en JS.
// Para colas grandes usa un índice de inicio o una lista enlazada.
const cola = [];
let frente = 0;
cola.push("a"); cola.push("b");
const primero = cola[frente++]; // "a" en O(1)
```

```python
pila = []
pila.append(1); pila.append(2)
pila.pop()          # 2

from collections import deque
cola = deque()
cola.append("a"); cola.append("b")
cola.popleft()      # "a" en O(1)  (list.pop(0) sería O(n))
```

Una **deque** (double-ended queue) permite insertar y quitar en ambos extremos en O(1); sirve como pila y como cola a la vez.

## ¿Cuándo usar una pila?

Busca estas señales:

- **Anidamiento o emparejamiento:** paréntesis, etiquetas HTML, bloques de código.
- **Deshacer / historial:** el botón "atrás" del navegador, Ctrl+Z.
- **Recursión explícita:** toda recursión usa la pila de llamadas; puedes simularla con una pila propia para evitar desbordamientos (DFS iterativo).
- **Evaluar expresiones:** notación posfija, calculadoras.
- **"El siguiente mayor/menor":** pila monótona (abajo).

## ¿Cuándo usar una cola?

- **Procesar en orden de llegada:** tareas, peticiones, mensajes.
- **Recorridos por niveles:** BFS en árboles y grafos (lo verás en la siguiente lección).
- **Buffers y productores/consumidores** en sistemas concurrentes.

## Patrón: pila monótona

Una pila que mantienes **siempre ordenada** (creciente o decreciente). Cuando llega un elemento que rompe el orden, sacas elementos hasta restaurarlo; cada elemento que sacas acaba de encontrar su "siguiente mayor" (o menor).

```js
// Para cada posición, ¿cuál es el siguiente elemento mayor a la derecha? (-1 si no hay)
function siguienteMayor(nums) {
  const res = new Array(nums.length).fill(-1);
  const pila = []; // guarda índices con valores decrecientes
  for (let i = 0; i < nums.length; i++) {
    while (pila.length && nums[pila.at(-1)] < nums[i]) {
      res[pila.pop()] = nums[i];
    }
    pila.push(i);
  }
  return res;
}
// [2, 1, 5, 3, 6] → [5, 5, 6, 6, -1]
```

Aunque hay un `while` dentro del `for`, cada índice entra y sale de la pila **una sola vez**: el total es O(n).

## Implementar una con la otra

Pregunta clásica de diseño: construir una cola usando sólo pilas (o viceversa). La idea con dos pilas: una recibe los `enqueue`; cuando necesitas `dequeue` y la segunda está vacía, vuelcas la primera en la segunda (esto invierte el orden). Cada elemento se mueve una sola vez → O(1) amortizado.

## Colas de prioridad (heaps)

Cuando no importa el orden de llegada sino **la prioridad**, se usa un *heap*: obtener el mínimo (o máximo) es O(1) e insertar/quitar es O(log n). Es la herramienta para "los k mayores", "mezclar k listas ordenadas" o el algoritmo de Dijkstra.

```python
import heapq
h = []
heapq.heappush(h, 5); heapq.heappush(h, 1); heapq.heappush(h, 3)
heapq.heappop(h)   # 1 (min-heap)
```

En JavaScript no hay heap nativo; en entrevista puedes decir "asumo una clase MinHeap" o implementar una básica si te lo piden.

## Errores frecuentes

- Hacer `pop` o `peek` sobre una estructura **vacía**. Verifica siempre.
- Usar `shift()` / `pop(0)` en ciclos grandes y convertir sin querer una solución O(n) en O(n²).
- Olvidar revisar, al final, que la pila quedó vacía (por ejemplo, paréntesis sin cerrar).
