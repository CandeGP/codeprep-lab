---
title: Recursión y programación dinámica
order: 9
summary: Pensar un problema en términos de subproblemas más pequeños, y evitar recalcularlos con memoización o tablas.
tags: [recursión, backtracking, memoización, programación dinámica, dp, top-down, bottom-up]
---

## Pensar recursivamente

Una función recursiva resuelve un problema **suponiendo que ya sabe resolver versiones más pequeñas**. Siempre tiene dos partes:

1. **Caso base:** la entrada más pequeña, que se responde directamente.
2. **Paso recursivo:** reduce el problema y combina las respuestas.

Pregúntate: *"Si alguien me diera la respuesta para n − 1 (o para la mitad izquierda, o para los hijos), ¿cómo obtendría la respuesta para n?"*

```js
// Suma de los dígitos de un número
function sumaDigitos(n) {
  if (n < 10) return n;                        // caso base
  return (n % 10) + sumaDigitos(Math.floor(n / 10)); // reduce y combina
}
```

Enfoques comunes para dividir:

- **De abajo hacia arriba:** construir la solución para n a partir de n − 1.
- **Divide y vencerás:** partir en mitades (merge sort, búsqueda binaria).
- **Elecciones:** en cada paso decides algo (tomar o no tomar un elemento) y exploras cada opción.

## Backtracking

Es recursión que **explora opciones y deshace** la elección antes de probar la siguiente. Sirve para generar combinaciones, resolver rompecabezas o buscar caminos.

```python
def combinaciones(nums, k):
    res, actual = [], []
    def explorar(inicio):
        if len(actual) == k:
            res.append(actual[:])     # copia de la solución
            return
        for i in range(inicio, len(nums)):
            actual.append(nums[i])     # elegir
            explorar(i + 1)            # explorar
            actual.pop()               # deshacer
    explorar(0)
    return res
```

Poda: si puedes saber que una rama nunca llevará a una solución válida, córtala pronto; es la diferencia entre un backtracking usable y uno que tarda horas.

## El problema: subproblemas repetidos

Considera contar de cuántas formas se sube una escalera de n peldaños dando pasos de 1 o 2:

```js
function formas(n) {
  if (n <= 1) return 1;
  return formas(n - 1) + formas(n - 2);
}
```

`formas(5)` llama a `formas(3)` dos veces, `formas(2)` tres veces… El árbol crece como O(2ⁿ). Pero sólo hay **n subproblemas distintos**. La programación dinámica (DP) aprovecha eso.

## Top-down: memoización

Misma recursión, pero guardas cada resultado la primera vez que lo calculas.

```js
function formas(n, memo = new Map()) {
  if (n <= 1) return 1;
  if (memo.has(n)) return memo.get(n);
  const r = formas(n - 1, memo) + formas(n - 2, memo);
  memo.set(n, r);
  return r;
}
// O(n) tiempo, O(n) espacio
```

```python
from functools import lru_cache

@lru_cache(maxsize=None)
def formas(n):
    return 1 if n <= 1 else formas(n - 1) + formas(n - 2)
```

## Bottom-up: tabulación

Llenas una tabla desde los casos base hacia arriba, en un orden que garantiza que los subproblemas necesarios ya estén calculados. Sin recursión, sin riesgo de desbordar la pila.

```python
def formas(n):
    if n <= 1:
        return 1
    a, b = 1, 1          # formas(0), formas(1)
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b
# O(n) tiempo, O(1) espacio: sólo guardamos lo que necesitamos
```

## Receta para diseñar una DP

1. **Define el estado:** ¿qué información mínima identifica un subproblema? Ejemplo: `dp[i]` = mejor resultado usando los primeros i elementos; `dp[i][j]` = respuesta para los prefijos de dos strings.
2. **Escribe la transición:** cómo se calcula `dp[i]` a partir de estados más pequeños.
3. **Casos base.**
4. **Orden de cálculo:** que cada estado dependa sólo de estados ya calculados.
5. **Respuesta:** ¿está en `dp[n]`, en el máximo de la tabla, en `dp[n][m]`?
6. **Optimiza el espacio** si cada fila depende sólo de la anterior.

## Familias clásicas de DP

| Familia | Estado típico | Ejemplos |
|---|---|---|
| Lineal | `dp[i]` | escaleras, máxima suma sin elementos adyacentes |
| Dos secuencias | `dp[i][j]` | subsecuencia común más larga, distancia de edición |
| Mochila | `dp[i][capacidad]` | elegir objetos con peso límite, sumas de subconjuntos |
| Intervalos | `dp[i][j]` sobre un rango | multiplicación óptima de matrices, palíndromos |
| Cuadrícula | `dp[f][c]` | caminos en una matriz con costos |

## Ejemplo: subsecuencia común más larga

Una subsecuencia conserva el orden pero puede saltarse caracteres. `"ace"` es subsecuencia de `"abcde"`.

Estado: `dp[i][j]` = longitud de la LCS entre los primeros `i` caracteres de `a` y los primeros `j` de `b`.

Transición:

- Si `a[i-1] === b[j-1]`: `dp[i][j] = dp[i-1][j-1] + 1`
- Si no: `dp[i][j] = max(dp[i-1][j], dp[i][j-1])`

Tiempo y espacio O(n·m). Lo implementarás en los ejercicios.

## Recursión: costos a mencionar

- **Espacio de pila:** O(profundidad). Con profundidades de 10⁴–10⁵ puedes desbordar la pila (Python por defecto permite ~1000 niveles).
- Todo algoritmo recursivo puede reescribirse de forma iterativa con una pila explícita.

> En la entrevista, una estrategia muy efectiva: escribe primero la recursión simple, identifica los subproblemas repetidos en voz alta, agrega memoización y, si hay tiempo, conviértela a tabla y optimiza memoria.
