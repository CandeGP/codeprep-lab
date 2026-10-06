---
title: Árboles y grafos
order: 5
summary: Árboles binarios, BST, heaps y tries; representación de grafos y los dos recorridos que resuelven casi todo — DFS y BFS.
tags: [árbol binario, bst, heap, trie, grafo, dfs, bfs, recorridos]
---

## Vocabulario mínimo

- **Árbol:** estructura jerárquica sin ciclos; un nodo **raíz** y cada nodo tiene **hijos**. Un nodo sin hijos es una **hoja**.
- **Árbol binario:** cada nodo tiene como máximo dos hijos (`left`, `right`).
- **Altura:** número de niveles del camino más largo de la raíz a una hoja.
- **Árbol balanceado:** su altura es O(log n), lo que mantiene rápidas las operaciones. No significa "perfectamente simétrico".
- **Completo:** todos los niveles llenos excepto quizás el último, que se llena de izquierda a derecha (así son los heaps).

```js
class TreeNode {
  constructor(val, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}
```

En los ejercicios, los árboles se describen **por niveles** con `null` para huecos: `[3, 9, 20, null, null, 15, 7]` es

```
    3
   / \
  9   20
     /  \
    15   7
```

## Recorridos en profundidad (DFS)

Se nombran según **cuándo visitas la raíz** respecto a sus subárboles:

| Recorrido | Orden | Uso típico |
|---|---|---|
| Preorden | raíz → izq → der | Copiar / serializar un árbol |
| Inorden | izq → raíz → der | En un BST, produce los valores **ordenados** |
| Postorden | izq → der → raíz | Calcular algo que depende de los hijos (alturas, borrar) |

```python
def inorden(nodo, res):
    if not nodo:
        return
    inorden(nodo.left, res)
    res.append(nodo.val)
    inorden(nodo.right, res)
```

La plantilla recursiva casi universal para árboles: **"resuelve para los hijos y combina"**.

```js
function altura(nodo) {
  if (!nodo) return 0;                        // caso base
  return 1 + Math.max(altura(nodo.left), altura(nodo.right)); // combinar
}
```

## Árbol binario de búsqueda (BST)

Invariante: para **cada** nodo, todo su subárbol izquierdo es menor y todo su subárbol derecho es mayor. Buscar, insertar y borrar cuestan O(altura): O(log n) si está balanceado, O(n) si degeneró en una "lista".

Ojo: no basta comparar cada nodo con sus hijos directos; la regla aplica a **todos los descendientes**.

## Heaps

Árbol binario completo donde cada padre es ≤ sus hijos (min-heap) o ≥ (max-heap). Se guarda en un arreglo: los hijos del índice `i` están en `2i+1` y `2i+2`. Insertar y extraer la raíz: O(log n). Es la implementación estándar de una cola de prioridad.

## Tries (árboles de prefijos)

Cada nodo representa un carácter y un camino desde la raíz forma un prefijo. Permiten saber si existe una palabra **o un prefijo** en O(longitud de la palabra), sin importar cuántas palabras haya. Perfectos para autocompletar.

## Grafos

Un grafo es un conjunto de **nodos** conectados por **aristas**, que pueden ser dirigidas o no, y con o sin peso. Un árbol es un grafo conexo sin ciclos.

Representaciones:

- **Lista de adyacencia** (la más común): para cada nodo, la lista de sus vecinos. Espacio O(V + E).
- **Matriz de adyacencia:** `M[a][b] = 1` si hay arista. Espacio O(V²); útil en grafos densos.
- **Cuadrícula implícita:** en muchos problemas el "grafo" es una matriz y los vecinos son las 4 (u 8) celdas adyacentes.

```python
from collections import defaultdict
grafo = defaultdict(list)
for a, b in aristas:
    grafo[a].append(b)
    grafo[b].append(a)   # si no es dirigido
```

## DFS en grafos

Explora un camino hasta el fondo antes de retroceder. **Siempre** marca los nodos visitados, o los ciclos te harán girar para siempre.

```js
function dfs(nodo, grafo, visitados) {
  if (visitados.has(nodo)) return;
  visitados.add(nodo);
  for (const vecino of grafo.get(nodo) ?? []) dfs(vecino, grafo, visitados);
}
```

Útil para: detectar ciclos, componentes conexas, ordenamiento topológico, backtracking.

## BFS en grafos

Explora por **capas**: primero todos los vecinos a distancia 1, luego a distancia 2, etc. Usa una cola. En grafos **sin peso**, BFS encuentra el **camino más corto**.

```python
from collections import deque

def distancias(inicio, grafo):
    dist = {inicio: 0}
    cola = deque([inicio])
    while cola:
        nodo = cola.popleft()
        for v in grafo[nodo]:
            if v not in dist:
                dist[v] = dist[nodo] + 1
                cola.append(v)
    return dist
```

Ambos recorridos cuestan **O(V + E)**.

## ¿DFS o BFS?

- ¿Camino más corto en pasos? → **BFS**.
- ¿Explorar todo, detectar ciclos, o el problema es naturalmente recursivo? → **DFS**.
- ¿Profundidad enorme? DFS recursivo puede desbordar la pila; usa DFS con pila explícita o BFS.

## Más allá (para mencionar en entrevista)

- **Ordenamiento topológico:** orden de tareas con dependencias en un grafo dirigido acíclico.
- **Dijkstra:** camino más corto con pesos no negativos, usando un heap: O((V + E) log V).
- **Union-Find:** agrupar elementos en conjuntos y preguntar "¿están conectados?" casi en O(1).
