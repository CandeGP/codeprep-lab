---
title: Listas enlazadas
order: 3
summary: Nodos conectados por referencias. Cómo recorrerlos, modificarlos sin perder el hilo y los trucos (nodo centinela, puntero rápido y lento) que resuelven la mayoría de los problemas.
tags: [linked list, punteros, nodo centinela, rápido y lento, recursión]
---

## La idea

Una lista enlazada es una cadena de **nodos**; cada nodo guarda un valor y una referencia al siguiente. A diferencia de un arreglo, los nodos pueden estar dispersos en memoria.

```js
class ListNode {
  constructor(val, next = null) {
    this.val = val;
    this.next = next;
  }
}
// 1 → 2 → 3 → null
const cabeza = new ListNode(1, new ListNode(2, new ListNode(3)));
```

```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next
```

En los ejercicios de esta plataforma, las listas llegan como `ListNode` ya construidos y puedes devolver un `ListNode` (o `null` / `None`); el corrector los convierte a arreglos para compararlos.

## Arreglo vs. lista enlazada

| Operación | Arreglo | Lista enlazada |
|---|---|---|
| Acceso al elemento k | O(1) | O(k) |
| Insertar/borrar al inicio | O(n) | O(1) |
| Insertar/borrar después de un nodo conocido | O(n) | O(1) |
| Memoria extra | Ninguna | Una referencia por nodo |
| Localidad de caché | Excelente | Pobre |

Variantes: **doblemente enlazada** (cada nodo conoce al anterior y al siguiente, útil para borrar en O(1) teniendo el nodo) y **circular** (el último apunta al primero).

## Recorrer sin perderse

El recorrido básico usa un puntero que avanza hasta `null`:

```python
def longitud(cabeza):
    n = 0
    actual = cabeza
    while actual:
        n += 1
        actual = actual.next
    return n
```

**Regla de oro al modificar enlaces:** guarda la referencia al siguiente nodo **antes** de cambiar `next`. Si la sobrescribes primero, pierdes el resto de la lista.

## Técnica 1: nodo centinela (dummy)

Muchos casos borde aparecen cuando hay que modificar la **cabeza** (borrar el primer nodo, insertar antes de todos, lista vacía). Un nodo falso al inicio elimina esos casos especiales:

```js
function eliminarValor(cabeza, objetivo) {
  const dummy = new ListNode(0, cabeza);
  let prev = dummy;
  while (prev.next) {
    if (prev.next.val === objetivo) prev.next = prev.next.next; // salta el nodo
    else prev = prev.next;
  }
  return dummy.next; // la nueva cabeza (puede haber cambiado)
}
```

## Técnica 2: puntero lento y rápido

Dos punteros que avanzan a distinta velocidad revelan información sobre la **forma** de la lista en una sola pasada:

- Si `rápido` avanza 2 y `lento` avanza 1, cuando `rápido` llega al final, `lento` está **a la mitad**.
- Si hay un **ciclo**, `rápido` termina alcanzando a `lento` (algoritmo de Floyd).
- Para encontrar el k-ésimo desde el final: adelanta un puntero k pasos y luego mueve ambos a la par.

```python
def hay_ciclo(cabeza):
    lento = rapido = cabeza
    while rapido and rapido.next:
        lento = lento.next
        rapido = rapido.next.next
        if lento is rapido:
            return True
    return False
```

## Técnica 3: invertir enlaces

Invertir (toda la lista o un tramo) aparece constantemente como subpaso: para comparar mitades, sumar números al revés, reordenar, etc. Memoriza el baile de tres punteros:

```js
let prev = null, actual = cabeza;
while (actual) {
  const siguiente = actual.next; // 1. guarda
  actual.next = prev;            // 2. voltea
  prev = actual;                 // 3. avanza prev
  actual = siguiente;            // 4. avanza actual
}
// prev es la nueva cabeza
```

## Técnica 4: recursión

Las listas son estructuras recursivas: una lista es "un nodo seguido de otra lista". Muchas soluciones quedan muy limpias recursivamente, pero usan O(n) de pila. En entrevista menciona ese costo y ofrece la versión iterativa si la memoria importa.

## Errores frecuentes

- Olvidar el caso de **lista vacía** o de **un solo nodo**.
- Acceder a `nodo.next.next` sin verificar que `nodo.next` existe.
- Devolver la cabeza vieja cuando la operación la cambió.
- Crear ciclos accidentales al reconectar nodos (y luego un ciclo infinito al imprimir).

> Consejo: dibuja 3 o 4 cajas con flechas y ejecuta tu algoritmo a mano, cambiando flecha por flecha. En listas enlazadas, el dibujo vale más que cualquier intuición.
