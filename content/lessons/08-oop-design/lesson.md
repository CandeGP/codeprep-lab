---
title: Diseño orientado a objetos
order: 8
summary: Cómo abordar preguntas del tipo "diseña un estacionamiento" o "modela un juego de cartas", con principios SOLID y patrones que conviene reconocer.
tags: [poo, diseño, solid, patrones, clases, interfaces]
---

## Qué se evalúa

En estas preguntas no hay una respuesta única. El entrevistador observa **cómo organizas el problema**: qué preguntas haces, qué entidades identificas, cómo repartes responsabilidades y si tu diseño aguanta cambios. Escribir código completo casi nunca es el objetivo; unas cuantas clases y firmas de métodos bien pensadas valen más.

## Un proceso en 5 pasos

1. **Aclara el alcance.** ¿Quién usa el sistema? ¿Qué acciones son imprescindibles? ¿Qué queda fuera? Por ejemplo, para un sistema de reservas de un cine: ¿hay varias salas? ¿asientos numerados? ¿pagos?
2. **Identifica los objetos centrales.** Subraya los sustantivos importantes: `Cine`, `Sala`, `Función`, `Asiento`, `Reserva`, `Cliente`.
3. **Define relaciones.** ¿Quién contiene a quién? ¿Es uno a muchos? Una `Sala` tiene muchos `Asiento`; una `Función` ocurre en una `Sala`; una `Reserva` agrupa asientos de una función.
4. **Asigna acciones (métodos).** Los verbos sugieren métodos: `funcion.asientosDisponibles()`, `reserva.confirmar()`, `reserva.cancelar()`.
5. **Revisa con escenarios.** Recorre casos: dos personas intentan reservar el mismo asiento; se cancela una función; cambian los precios. Ajusta el diseño.

## Los cuatro pilares

- **Encapsulamiento:** el estado interno se modifica sólo a través de métodos que protegen las reglas (nadie cambia `saldo` directamente; se llama a `depositar()`).
- **Abstracción:** expones *qué* hace un objeto, no *cómo*.
- **Herencia:** una clase especializa a otra (`CuentaAhorro extends Cuenta`). Úsala con moderación.
- **Polimorfismo:** distintos objetos responden al mismo mensaje a su manera (`figura.area()` para círculos y rectángulos).

> **Composición sobre herencia:** en lugar de jerarquías profundas, arma objetos a partir de piezas. Un `Vehiculo` *tiene* un `Motor` en vez de que existan `VehiculoElectrico`, `VehiculoGasolina`, `VehiculoElectricoConRemolque`…

## Principios SOLID (resumen práctico)

| Principio | Idea en una línea |
|---|---|
| **S**ingle responsibility | Cada clase tiene una sola razón para cambiar. |
| **O**pen/closed | Extiendes comportamiento agregando código, no modificando el existente. |
| **L**iskov substitution | Una subclase debe poder usarse donde se espera la clase base sin sorpresas. |
| **I**nterface segregation | Mejor varias interfaces pequeñas que una gigante. |
| **D**ependency inversion | Depende de abstracciones (interfaces), no de implementaciones concretas. |

## Patrones que conviene reconocer

- **Singleton:** una sola instancia global (configuración, registro). Úsalo poco: complica las pruebas.
- **Factory:** una función o clase decide qué subtipo crear (`crearNotificacion("email")`).
- **Strategy:** encapsula algoritmos intercambiables (distintas tarifas de estacionamiento por hora, por día, para miembros).
- **Observer:** objetos se suscriben a eventos de otro (notificar a los clientes cuando se libera un asiento).
- **Decorator:** envuelve un objeto para añadir comportamiento sin modificarlo (agregar caché o registro a un servicio).

## Ejemplo breve: máquina expendedora

```ts
class Producto {
  constructor(readonly codigo: string, readonly nombre: string, readonly precio: number) {}
}

class Ranura {
  constructor(readonly producto: Producto, private cantidad: number) {}
  hayExistencia() { return this.cantidad > 0; }
  despachar() {
    if (!this.hayExistencia()) throw new Error("Agotado");
    this.cantidad--;
    return this.producto;
  }
}

interface MetodoPago { cobrar(monto: number): boolean } // Strategy: efectivo, tarjeta, QR…

class MaquinaExpendedora {
  constructor(private ranuras: Map<string, Ranura>) {}
  comprar(codigo: string, pago: MetodoPago): Producto {
    const ranura = this.ranuras.get(codigo);
    if (!ranura?.hayExistencia()) throw new Error("No disponible");
    if (!pago.cobrar(ranura.producto.precio)) throw new Error("Pago rechazado");
    return ranura.despachar();
  }
}
```

Observa las decisiones: la ranura protege su propio inventario (encapsulamiento), el método de pago es intercambiable (Strategy) y la máquina sólo coordina. Si mañana se agrega pago con criptomonedas, basta una nueva clase que implemente `MetodoPago` (abierto/cerrado).

## Estructuras de datos dentro del diseño

Muchos diseños "de objetos" en realidad se deciden por la estructura de datos interna. El ejemplo más famoso es la **caché LRU** (descarta el elemento usado hace más tiempo): combina un **mapa** (búsqueda O(1)) con una **lista doblemente enlazada** (mover al frente y quitar del final en O(1)). En JavaScript, `Map` conserva el orden de inserción, lo que permite una versión compacta; en Python, `OrderedDict` cumple el mismo papel.

## Errores frecuentes

- Empezar a escribir clases sin aclarar requisitos.
- Crear jerarquías de herencia profundas "por si acaso".
- Clases "Dios" que hacen todo (`SistemaManager`).
- Ignorar la concurrencia cuando es evidente (dos usuarios reservando el mismo recurso).
