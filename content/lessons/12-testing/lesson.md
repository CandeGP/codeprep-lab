---
title: Pruebas y depuración
order: 12
summary: Cómo verificar tu propio código durante la entrevista, qué casos borde nunca olvidar y cómo hablar de pruebas en proyectos reales.
tags: [testing, casos borde, pruebas unitarias, depuración, calidad]
---

## Probar es parte de resolver

Terminar de escribir el código no es terminar el problema. Un candidato que **encuentra y corrige su propio error** suele causar mejor impresión que uno que entrega código sin revisarlo y espera que el entrevistador lo pruebe por él.

## Tres niveles de verificación en la entrevista

1. **Lectura crítica (sin ejecutar).** Lee tu código línea por línea como si fuera de otra persona. Busca: índices fuera de rango, condiciones `<` vs `<=`, variables sin inicializar, `return` faltantes, mutaciones accidentales.
2. **Ejecución a mano con un ejemplo pequeño.** Elige una entrada de 3–5 elementos y lleva una tabla con el valor de cada variable en cada iteración. Ejemplos grandes consumen tiempo y esconden errores.
3. **Casos borde.** Pruébalos mentalmente uno por uno (lista abajo).

## Catálogo de casos borde

| Tipo de entrada | Casos a revisar |
|---|---|
| Arreglos / strings | vacío, un elemento, dos elementos, todos iguales, ya ordenado, orden inverso |
| Números | 0, negativos, muy grandes (desbordamiento), valores repetidos |
| Listas enlazadas | `null`, un nodo, dos nodos, ciclo |
| Árboles | vacío, sólo raíz, degenerado (lista), perfectamente balanceado |
| Grafos | nodo aislado, ciclo, grafo desconectado, auto-aristas |
| Strings | espacios, mayúsculas/minúsculas, caracteres Unicode, sólo símbolos |
| Intervalos | que se tocan en un punto, contenidos uno en otro, idénticos |

## Cómo diseñar casos de prueba (fuera de la entrevista también)

- **Partición en clases de equivalencia:** agrupa las entradas que el código debería tratar igual y prueba una de cada grupo.
- **Valores límite:** los errores viven en los bordes (0, 1, n−1, n, máximo permitido).
- **Casos inválidos:** ¿qué debe pasar con `null`, tipos incorrectos o datos fuera de rango? ¿Error, valor por defecto, excepción?
- **Propiedades:** a veces es más fácil verificar una propiedad que el resultado exacto. Por ejemplo, el resultado de un ordenamiento debe estar ordenado **y** ser una permutación de la entrada.

## Pruebas unitarias en código real

```js
// Con un framework como Vitest o Jest
import { describe, it, expect } from "vitest";
import { fusionarIntervalos } from "./intervalos";

describe("fusionarIntervalos", () => {
  it("fusiona intervalos que se traslapan", () => {
    expect(fusionarIntervalos([[1, 3], [2, 6]])).toEqual([[1, 6]]);
  });
  it("fusiona intervalos que sólo se tocan", () => {
    expect(fusionarIntervalos([[1, 4], [4, 5]])).toEqual([[1, 5]]);
  });
  it("devuelve vacío para entrada vacía", () => {
    expect(fusionarIntervalos([])).toEqual([]);
  });
});
```

```python
# Con pytest
from intervalos import fusionar_intervalos

def test_traslape():
    assert fusionar_intervalos([[1, 3], [2, 6]]) == [[1, 6]]

def test_vacio():
    assert fusionar_intervalos([]) == []
```

Buenas prácticas: una idea por prueba, nombres que describan el comportamiento esperado, pruebas deterministas (sin depender de la hora o del azar sin semilla) y rápidas.

## La pirámide de pruebas

- **Unitarias (muchas):** una función o clase aislada. Rápidas y precisas.
- **Integración (algunas):** varios componentes juntos (API + base de datos).
- **De extremo a extremo (pocas):** el sistema completo desde la perspectiva del usuario. Valiosas pero lentas y frágiles.

## Depurar con método

Cuando algo falla, adivinar cambia tu código sin mejorarlo. Mejor:

1. **Reproduce** el problema de forma confiable con la entrada más pequeña posible.
2. **Formula una hipótesis** concreta ("creo que `izq` se queda atrás cuando hay duplicados").
3. **Verifica** la hipótesis con un `console.log`/`print` o un depurador, no cambiando código al azar.
4. **Corrige y agrega una prueba** que habría detectado el error.

> En la plataforma, usa `console.log` o `print` dentro de tu solución: la salida aparece en la sección "Consola" debajo de los resultados de las pruebas.
