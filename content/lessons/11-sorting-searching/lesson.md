---
title: Ordenamiento y búsqueda
order: 11
summary: Los algoritmos de ordenamiento que debes poder explicar, cuándo cada uno conviene, y la búsqueda binaria en todas sus variantes.
tags: [ordenamiento, merge sort, quicksort, búsqueda binaria, intervalos, counting sort]
---

## Por qué ordenar ayuda tanto

Ordenar cuesta O(n log n) y muchas veces **convierte un problema difícil en uno fácil**: los duplicados quedan juntos, los intervalos se pueden recorrer de izquierda a derecha y se habilitan dos punteros y búsqueda binaria. Antes de complicarte, pregúntate: *¿y si ordeno primero?*

## Los algoritmos que debes conocer

| Algoritmo | Promedio | Peor caso | Espacio | ¿Estable? | Nota |
|---|---|---|---|---|---|
| Burbuja / inserción | O(n²) | O(n²) | O(1) | Sí | Inserción es muy buena con arreglos pequeños o casi ordenados |
| Selección | O(n²) | O(n²) | O(1) | No | Mínimo número de intercambios |
| Merge sort | O(n log n) | O(n log n) | O(n) | Sí | Predecible; ideal para listas enlazadas y datos externos |
| Quicksort | O(n log n) | O(n²) | O(log n) | No | Muy rápido en la práctica con pivote aleatorio |
| Heap sort | O(n log n) | O(n log n) | O(1) | No | In-place con garantía de peor caso |
| Counting / radix | O(n + k) | O(n + k) | O(n + k) | Sí | Sólo para claves enteras en rango acotado |

**Estable** significa que elementos con la misma clave conservan su orden original, lo cual importa al ordenar por varios criterios.

Los ordenamientos por comparación no pueden ser mejores que **O(n log n)** en el peor caso. Counting y radix sort lo "rompen" porque no comparan: aprovechan la estructura de las claves.

### Merge sort: divide y vencerás

```js
function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = arr.length >> 1;
  const izq = mergeSort(arr.slice(0, mid));
  const der = mergeSort(arr.slice(mid));
  const res = [];
  let i = 0, j = 0;
  while (i < izq.length && j < der.length) res.push(izq[i] <= der[j] ? izq[i++] : der[j++]);
  return res.concat(izq.slice(i), der.slice(j));
}
```

### Quicksort: partición alrededor de un pivote

Elige un pivote, coloca los menores a la izquierda y los mayores a la derecha, y repite en cada lado. Con pivote aleatorio, el caso O(n²) es extremadamente improbable. La misma idea de partición da **quickselect**: el k-ésimo menor en O(n) promedio.

## Ordenar en tu lenguaje (¡cuidado en JS!)

```js
[10, 9, 1].sort();              // [1, 10, 9]  ← ¡compara como strings!
[10, 9, 1].sort((a, b) => a - b); // [1, 9, 10]
personas.sort((a, b) => a.edad - b.edad || a.nombre.localeCompare(b.nombre));
```

```python
sorted([10, 9, 1])                       # [1, 9, 10]
personas.sort(key=lambda p: (p.edad, p.nombre))
```

Ambos usan algoritmos estables O(n log n) (TimSort o variantes).

## Búsqueda binaria

Funciona sobre cualquier espacio **monótono**: un arreglo ordenado, o una condición que es falsa hasta cierto punto y verdadera a partir de ahí.

```python
def primer_mayor_o_igual(nums, objetivo):
    lo, hi = 0, len(nums)            # intervalo [lo, hi)
    while lo < hi:
        mid = (lo + hi) // 2
        if nums[mid] < objetivo:
            lo = mid + 1
        else:
            hi = mid
    return lo  # índice de inserción
```

Consejos para no equivocarte:

- Decide si tu intervalo es cerrado `[lo, hi]` o semiabierto `[lo, hi)` y **sé consistente**.
- Asegúrate de que el intervalo **siempre se reduce** (evita ciclos infinitos con `lo = mid`).
- Prueba con arreglos de 0, 1 y 2 elementos.
- En lenguajes con enteros fijos, `mid = lo + (hi - lo) / 2` evita desbordes.

### Búsqueda binaria sobre la respuesta

Cuando preguntan "¿cuál es el mínimo X tal que se cumple la condición?" y la condición es monótona en X, puedes buscar binariamente **el valor de X**, sin arreglo explícito. Ejemplo: la velocidad mínima para terminar un trabajo en H horas, o la capacidad mínima de un camión para mover todo en D días.

## Problemas típicos donde ordenar resuelve

- **Intervalos:** ordena por inicio y fusiona los que se traslapan.
- **Encontrar duplicados o agrupar:** después de ordenar, los iguales quedan contiguos.
- **Los k más grandes/frecuentes:** un heap de tamaño k (O(n log k)) o *bucket sort* por frecuencia (O(n)).
- **Datos que no caben en memoria:** ordena por bloques y luego haz una mezcla de k vías (ordenamiento externo).
