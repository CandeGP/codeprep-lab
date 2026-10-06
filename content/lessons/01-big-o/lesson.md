---
title: Complejidad y notación Big O
order: 1
summary: Cómo medir cuánto crece el tiempo y la memoria de un algoritmo cuando crece la entrada, y cómo explicarlo en voz alta durante una entrevista.
tags: [big o, complejidad, tiempo, espacio, análisis]
---

## ¿Por qué importa?

En una entrevista casi nunca basta con que tu código "funcione". El entrevistador quiere saber **cómo se comporta cuando la entrada es enorme**. La notación Big O es el idioma común para esa conversación: describe la **tasa de crecimiento** del costo de un algoritmo, no los segundos exactos que tarda.

Imagina que organizas una fiesta y debes saludar a los invitados. Si saludas a cada persona una vez, el esfuerzo crece al mismo ritmo que la lista (O(n)). Si en cambio cada invitado debe estrecharle la mano a todos los demás, con 10 personas son 45 saludos, pero con 1,000 son casi medio millón (O(n²)). Y si sólo pones un letrero de "Bienvenidos" en la puerta, da igual cuántos lleguen (O(1)). Big O resume ese tipo de razonamiento: **qué tan rápido explota el trabajo** cuando la entrada crece.

## Tiempo y espacio

- **Complejidad temporal**: cuántas operaciones básicas hace el algoritmo en función del tamaño de la entrada `n`.
- **Complejidad espacial**: cuánta memoria **adicional** necesita (variables, estructuras auxiliares, pila de recursión).

La recursión consume espacio aunque no lo veas: cada llamada activa ocupa un marco en la pila. Una función recursiva que baja `n` niveles usa O(n) de espacio.

```js
// O(n) tiempo y O(n) espacio por la pila de llamadas
function sumaHasta(n) {
  if (n === 0) return 0;
  return n + sumaHasta(n - 1);
}

// O(n) tiempo y O(1) espacio
function sumaHastaIterativa(n) {
  let total = 0;
  for (let i = 1; i <= n; i++) total += i;
  return total;
}
```

## Reglas prácticas para simplificar

1. **Ignora las constantes.** O(2n) es O(n). O(500) es O(1). Big O habla de la forma de la curva, no de su escala.
2. **Quédate con el término dominante.** O(n² + n) es O(n²); O(n + log n) es O(n). Cuando `n` es grande, el término más rápido aplasta al resto.
3. **Suma para pasos consecutivos, multiplica para pasos anidados.**

```python
def ejemplo(a, b):
    for x in a:          # O(A)
        print(x)
    for y in b:          # O(B)
        print(y)
    # Total: O(A + B), NO O(n) — son entradas distintas

def pares(a, b):
    for x in a:
        for y in b:      # por cada x recorre todo b
            print(x, y)
    # Total: O(A * B)
```

4. **Usa variables distintas para entradas distintas.** Un error clásico es decir "O(n²)" cuando en realidad es O(a·b) porque los dos arreglos tienen tamaños independientes.

## Las complejidades más comunes

| Notación | Nombre | Ejemplo típico |
|---|---|---|
| O(1) | Constante | Acceder a `arr[i]`, insertar en un hash map (promedio) |
| O(log n) | Logarítmica | Búsqueda binaria |
| O(n) | Lineal | Recorrer un arreglo una vez |
| O(n log n) | Linealítmica | Ordenamientos eficientes (merge sort, heap sort) |
| O(n²) | Cuadrática | Dos ciclos anidados sobre la misma entrada |
| O(2ⁿ) | Exponencial | Generar todos los subconjuntos |
| O(n!) | Factorial | Generar todas las permutaciones |

## ¿De dónde sale el log n?

Cuando en cada paso **descartas una fracción constante** del problema (por ejemplo, la mitad), el número de pasos es logarítmico. Si empiezas con 1,024 elementos y partes a la mitad cada vez: 1024 → 512 → 256 → … → 1. Son 10 pasos, y log₂(1024) = 10.

La base del logaritmo no importa en Big O: log₂ n y log₁₀ n sólo difieren por una constante.

## Recursión con varias ramas

Cuando una función se llama a sí misma **más de una vez**, el número de llamadas suele crecer como `ramas^profundidad`.

```js
// Fibonacci ingenuo: cada llamada genera 2 llamadas → O(2^n) tiempo
function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}
```

El espacio, en cambio, es O(n): en un momento dado sólo hay una rama activa en la pila, con profundidad máxima `n`. Con memoización (guardar resultados ya calculados) baja a O(n) tiempo, como verás en la lección de programación dinámica.

## Caso mejor, peor y esperado

- **Peor caso**: la entrada más desfavorable. Es lo que normalmente se reporta.
- **Caso esperado (promedio)**: el comportamiento típico. Por ejemplo, quicksort es O(n log n) esperado pero O(n²) en el peor caso.
- **Mejor caso**: rara vez es útil; casi cualquier algoritmo puede tener un mejor caso trivial.

No confundas estos casos con Big O / Big Omega / Big Theta. En la industria, "Big O" suele usarse como la cota ajustada (lo que formalmente sería Θ).

## Tiempo amortizado

Un arreglo dinámico (como `Array` en JS o `list` en Python) duplica su capacidad cuando se llena. Esa copia cuesta O(n), pero ocurre tan rara vez que, **repartida entre todas las inserciones**, cada `push` cuesta O(1) amortizado. Si insertas `n` elementos, las copias suman 1 + 2 + 4 + … + n ≈ 2n, es decir O(n) total → O(1) por inserción.

## Cómo explicarlo en la entrevista

1. Define qué es `n` (y `m`, si hay otra entrada).
2. Recorre tu código por bloques: "este ciclo es O(n), dentro hago una búsqueda en hash que es O(1)…".
3. Da tiempo **y** espacio.
4. Si existe una solución mejor, menciónala aunque no la implementes: "Esto es O(n log n) por el ordenamiento; con un hash map podríamos bajarlo a O(n) a cambio de O(n) de memoria".

> Regla de oro: el entrevistador valora más que razones en voz alta sobre complejidad que una respuesta memorizada.
