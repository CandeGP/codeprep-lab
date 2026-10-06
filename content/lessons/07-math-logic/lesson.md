---
title: Matemáticas y razonamiento lógico
order: 7
summary: Primos, divisibilidad, aritmética modular, probabilidad básica y una estrategia para atacar acertijos sin entrar en pánico.
tags: [primos, criba, mcd, módulo, probabilidad, acertijos]
---

## ¿Por qué aparecen en entrevistas?

Las preguntas matemáticas rara vez exigen teoremas avanzados. Evalúan si sabes **reducir un problema a algo que puedes contar o calcular**, y si detectas cuándo un truco matemático elimina un ciclo entero.

## Números primos

Un primo es un entero mayor que 1 cuyo único divisor positivo, además de 1, es él mismo. Todo entero mayor que 1 se descompone **de forma única** en un producto de primos (teorema fundamental de la aritmética). Eso da reglas útiles:

- `a` divide a `b` si los exponentes primos de `a` son ≤ que los de `b`.
- El máximo común divisor toma el **mínimo** exponente de cada primo; el mínimo común múltiplo, el **máximo**.

### ¿Es primo?

Basta probar divisores hasta **√n**: si `n = a · b` y ambos fueran mayores que √n, su producto excedería n.

```js
function esPrimo(n) {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) {
    if (n % d === 0) return false;
  }
  return true;
}
// O(√n)
```

### Todos los primos hasta n: criba de Eratóstenes

En vez de probar cada número, **tacha los múltiplos** de cada primo que encuentres. Puedes empezar a tachar en `p²`, porque los múltiplos menores ya los tachó un primo más pequeño.

```python
def criba(n):
    es_primo = [True] * (n + 1)
    es_primo[0:2] = [False, False]
    p = 2
    while p * p <= n:
        if es_primo[p]:
            for m in range(p * p, n + 1, p):
                es_primo[m] = False
        p += 1
    return [i for i, v in enumerate(es_primo) if v]
# O(n log log n) tiempo, O(n) espacio
```

## Máximo común divisor (algoritmo de Euclides)

`mcd(a, b) = mcd(b, a mod b)`, y `mcd(a, 0) = a`. Converge muy rápido: O(log min(a, b)).

```js
const mcd = (a, b) => (b === 0 ? a : mcd(b, a % b));
const mcm = (a, b) => (a / mcd(a, b)) * b; // divide primero para evitar desbordes
```

## Aritmética modular

Cuando el resultado es enorme, los problemas piden "módulo 10⁹ + 7". Reglas:

- `(a + b) mod m = ((a mod m) + (b mod m)) mod m`
- `(a · b) mod m = ((a mod m) · (b mod m)) mod m`
- La resta requiere cuidado con negativos: `((a - b) % m + m) % m`.

En JavaScript, `a * b` pierde precisión si pasa de 2⁵³; usa `BigInt` para productos grandes. En Python no hay ese problema.

**Exponenciación rápida:** calcula `aⁿ` en O(log n) elevando al cuadrado.

```python
def potencia(a, n, m):
    r = 1
    a %= m
    while n:
        if n & 1:
            r = r * a % m
        a = a * a % m
        n >>= 1
    return r
```

## Conteo y combinatoria

- Permutaciones de n elementos: `n!`
- Formas de elegir k de n sin orden: `C(n, k) = n! / (k! (n-k)!)`
- Pares distintos entre n elementos: `n(n-1)/2` → por eso comparar todos contra todos es O(n²).
- Suma 1 + 2 + … + n = `n(n+1)/2`. Sirve para encontrar **el número faltante** de una secuencia en O(1) de memoria.

## Probabilidad básica

- Eventos **independientes**: `P(A y B) = P(A) · P(B)`.
- Eventos **mutuamente excluyentes**: `P(A o B) = P(A) + P(B)`.
- En general: `P(A o B) = P(A) + P(B) − P(A y B)`.
- Muchas veces es más fácil calcular el **complemento**: la probabilidad de "al menos uno" es `1 − P(ninguno)`.

Ejemplo: probabilidad de sacar al menos un 6 en 3 tiradas de un dado = 1 − (5/6)³ ≈ 0.42.

## Estrategia para acertijos

1. **Repite el problema en tus palabras** y confirma las reglas (¿se puede reutilizar algo? ¿cuántos intentos hay?).
2. **Prueba casos pequeños**: n = 1, 2, 3. Busca el patrón.
3. **Piensa en el peor caso**: muchos acertijos piden minimizar el número de intentos en el peor escenario; equilibra los resultados de cada paso.
4. **Busca invariantes**: algo que no cambia con cada movimiento (paridad, suma total, color de la casilla).
5. **Habla en voz alta.** El entrevistador puede darte pistas si ve tu razonamiento; en silencio no puede ayudarte.

> Ejemplo de invariante: en un tablero de ajedrez al que le quitas dos esquinas opuestas, no puedes cubrirlo con fichas de dominó de 2×1. Cada ficha cubre una casilla blanca y una negra, pero las esquinas opuestas son del mismo color, así que quedan desbalanceadas.
