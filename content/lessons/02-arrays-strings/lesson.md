---
title: Arreglos, strings y tablas hash
order: 2
summary: Las estructuras que aparecen en casi toda entrevista, cómo funcionan por dentro y los patrones que convierten soluciones O(n²) en O(n).
tags: [arrays, strings, hash map, set, dos punteros, ventana deslizante]
---

## Arreglos: memoria contigua

Un arreglo guarda sus elementos **uno junto al otro en memoria**. Por eso acceder a `arr[i]` es O(1): la dirección se calcula como `inicio + i × tamaño_del_elemento`.

El precio de esa contigüidad:

| Operación | Costo |
|---|---|
| Leer / escribir `arr[i]` | O(1) |
| Agregar al final (arreglo dinámico) | O(1) amortizado |
| Insertar o borrar al inicio / en medio | O(n) — hay que desplazar elementos |
| Buscar un valor sin orden | O(n) |
| Buscar un valor en arreglo ordenado | O(log n) con búsqueda binaria |

## Strings: arreglos de caracteres (casi siempre inmutables)

En JavaScript, Python, Java y C#, los strings son **inmutables**: cada concatenación crea un string nuevo. Concatenar en un ciclo puede volverse O(n²) sin que lo notes.

```js
// Riesgoso: cada += puede copiar todo el string acumulado
let s = "";
for (const palabra of palabras) s += palabra;

// Mejor: acumula en un arreglo y une al final → O(n) total
const partes = [];
for (const palabra of palabras) partes.push(palabra);
const resultado = partes.join("");
```

```python
# En Python, lo idiomático es ''.join(...)
resultado = "".join(palabras)
```

Recuerda preguntar en la entrevista: ¿el string es ASCII o Unicode? ¿Importan mayúsculas y espacios? Esas aclaraciones cambian la solución y muestran madurez.

## Tablas hash: el "comodín" de las entrevistas

Una tabla hash asocia **claves → valores** con inserción, búsqueda y borrado en **O(1) promedio**.

Cómo funciona por dentro:

1. Se calcula `hash(clave)`, un número entero.
2. Se reduce a un índice de un arreglo interno: `indice = hash % capacidad`.
3. Si dos claves caen en el mismo índice (**colisión**), se resuelve con listas en cada casilla (*chaining*) o buscando la siguiente casilla libre (*open addressing*).
4. Cuando la tabla se llena demasiado (factor de carga alto) se **redimensiona** y se reubican todas las claves: O(n) ocasional, O(1) amortizado.

El peor caso es O(n) (todas las claves colisionan), pero con una buena función hash es rarísimo.

| Lenguaje | Mapa | Conjunto |
|---|---|---|
| JavaScript | `Map` (o un objeto) | `Set` |
| Python | `dict` | `set` |
| Java | `HashMap` | `HashSet` |

## Patrón 1: cambiar tiempo por memoria

Muchas soluciones O(n²) comparan "cada elemento contra todos los demás". Si guardas lo que ya viste en un hash, la segunda búsqueda se vuelve O(1).

```python
def tiene_duplicados(nums):
    vistos = set()
    for x in nums:
        if x in vistos:
            return True
        vistos.add(x)
    return False
# O(n) tiempo, O(n) espacio — en vez de O(n²) tiempo, O(1) espacio
```

## Patrón 2: conteo de frecuencias

Para preguntas del tipo "¿tienen los mismos caracteres?", "¿cuál es el más frecuente?", "¿se puede formar X con las letras de Y?", cuenta ocurrencias.

```js
function frecuencias(texto) {
  const conteo = new Map();
  for (const c of texto) conteo.set(c, (conteo.get(c) ?? 0) + 1);
  return conteo;
}
```

Si el alfabeto es pequeño y fijo (por ejemplo, 26 letras minúsculas), un arreglo de 26 enteros es aún más rápido que un mapa.

## Patrón 3: dos punteros

Dos índices que avanzan según una regla, normalmente desde los extremos hacia el centro o ambos hacia la derecha a distinta velocidad.

```js
// ¿Es palíndromo? Compara extremos y avanza hacia el centro.
function esPalindromo(s) {
  let i = 0, j = s.length - 1;
  while (i < j) {
    if (s[i] !== s[j]) return false;
    i++;
    j--;
  }
  return true;
}
```

Funciona muy bien en arreglos **ordenados**: si la suma de los extremos es muy grande, mueves el derecho; si es muy pequeña, mueves el izquierdo.

## Patrón 4: ventana deslizante

Para subarreglos o substrings **contiguos**: mantienes una ventana `[izq, der]` que se expande por la derecha y se contrae por la izquierda cuando deja de cumplir la condición. Cada índice entra y sale como máximo una vez → O(n).

```python
def suma_maxima_k(nums, k):
    ventana = sum(nums[:k])
    mejor = ventana
    for der in range(k, len(nums)):
        ventana += nums[der] - nums[der - k]   # entra uno, sale otro
        mejor = max(mejor, ventana)
    return mejor
```

## Patrón 5: prefijos acumulados

Si necesitas muchas sumas de rangos, precalcula `pref[i] = nums[0] + … + nums[i-1]`. Entonces la suma de `[a, b]` es `pref[b+1] - pref[a]` en O(1).

## Matrices (arreglos 2D)

Recorrer una matriz de `f × c` es O(f·c). Ten a mano los desplazamientos a vecinos:

```js
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
for (const [df, dc] of DIRS) {
  const nf = f + df, nc = c + dc;
  if (nf >= 0 && nf < filas && nc >= 0 && nc < cols) {
    // vecino válido
  }
}
```

## Lista de verificación

- ¿Puedo **ordenar** primero (O(n log n)) para simplificar el problema?
- ¿Un **hash** me evita un ciclo anidado?
- ¿La respuesta es un bloque **contiguo**? → ventana deslizante o prefijos.
- ¿El arreglo está **ordenado**? → dos punteros o búsqueda binaria.
- ¿Puedo resolverlo **en el mismo arreglo** (in-place) para ahorrar memoria?
