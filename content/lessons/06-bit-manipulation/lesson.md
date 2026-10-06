---
title: Manipulación de bits
order: 6
summary: Operadores a nivel de bit, complemento a dos y un puñado de trucos (máscaras, XOR, n & (n-1)) que aparecen una y otra vez.
tags: [bits, xor, máscaras, complemento a dos, binario]
---

## Repaso rápido de binario

Cada posición de un número binario vale una potencia de 2. `1011₂` = 8 + 0 + 2 + 1 = 11. Numeramos los bits desde la derecha empezando en 0: el bit 0 es el **menos significativo**.

## Operadores

| Operador | JS / Python | Qué hace | Ejemplo (4 bits) |
|---|---|---|---|
| AND | `a & b` | 1 si ambos son 1 | `1100 & 1010 = 1000` |
| OR | `a \| b` | 1 si alguno es 1 | `1100 \| 1010 = 1110` |
| XOR | `a ^ b` | 1 si son distintos | `1100 ^ 1010 = 0110` |
| NOT | `~a` | Invierte todos los bits | `~0101 = 1010` |
| Desplazamiento izq. | `a << k` | Multiplica por 2ᵏ | `0011 << 2 = 1100` |
| Desplazamiento der. | `a >> k` | Divide entre 2ᵏ (conserva el signo) | `1100 >> 2 = 0011` |
| Desplazamiento der. lógico | `a >>> k` (sólo JS) | Rellena con ceros | útil con negativos |

> En JavaScript los operadores de bits trabajan sobre **enteros de 32 bits con signo**. En Python los enteros no tienen límite de tamaño, así que `~x` es `-x - 1` y los negativos se comportan como si tuvieran infinitos unos a la izquierda.

## Complemento a dos (números negativos)

Casi todos los procesadores representan los negativos así: para obtener `-x`, **invierte los bits de x y suma 1**. En 4 bits:

```
 3 = 0011
~3 = 1100
-3 = 1101
```

Consecuencias útiles: el bit más significativo indica el signo, y `x + (-x)` da exactamente 0 descartando el acarreo.

## Las operaciones de máscara básicas

Con una **máscara** `1 << i` (sólo el bit i encendido):

```js
const leer    = (n, i) => (n >> i) & 1;        // ¿el bit i es 1?
const encender = (n, i) => n | (1 << i);       // pone el bit i en 1
const apagar  = (n, i) => n & ~(1 << i);       // pone el bit i en 0
const alternar = (n, i) => n ^ (1 << i);       // invierte el bit i
```

Para **actualizar** el bit i a un valor `v` (0 o 1): primero apágalo y luego haz OR con `v << i`.

## Trucos que vale la pena memorizar

**1. `n & (n - 1)` apaga el bit 1 más bajo.** Restar 1 convierte el último 1 en 0 y los ceros a su derecha en unos; el AND limpia todo eso.

```
n       = 1011 0100
n - 1   = 1011 0011
n&(n-1) = 1011 0000
```

De ahí salen dos clásicos:

- `n > 0 && (n & (n - 1)) === 0` → n es **potencia de 2** (tiene un solo bit encendido).
- Contar bits en 1: repite `n &= n - 1` hasta que n sea 0; el número de repeticiones es la respuesta.

**2. `n & -n` aísla el bit 1 más bajo.** Gracias al complemento a dos.

**3. Propiedades de XOR:**

- `a ^ a = 0` y `a ^ 0 = a`
- Es conmutativo y asociativo: el orden no importa.

Por eso, si haces XOR de una lista donde todos los números aparecen dos veces excepto uno, las parejas se cancelan y queda el solitario.

```python
def solitario(nums):
    r = 0
    for x in nums:
        r ^= x
    return r
```

**4. Intercambiar sin variable temporal:** `a ^= b; b ^= a; a ^= b;` (curioso, pero en código real usa una temporal: es más claro).

## Bits como conjuntos

Un entero de k bits puede representar **un subconjunto** de k elementos: el bit i indica si el elemento i está presente. Recorrer todos los números de `0` a `2ᵏ - 1` recorre todos los subconjuntos. Es la base de muchas soluciones de programación dinámica sobre subconjuntos ("bitmask DP").

```js
const elementos = ["a", "b", "c"];
for (let mask = 0; mask < 1 << elementos.length; mask++) {
  const subconjunto = elementos.filter((_, i) => mask & (1 << i));
  console.log(subconjunto);
}
```

## En la entrevista

- Dibuja los números en binario: 8 bits bastan para razonar casi cualquier truco.
- Aclara el ancho (32 o 64 bits) y cómo deben tratarse los negativos.
- Si usas un truco, **explica por qué funciona**; no basta con recitarlo.
