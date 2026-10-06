---
title: Concurrencia e hilos
order: 13
summary: Procesos, hilos, condiciones de carrera, bloqueos y deadlocks; el vocabulario mínimo para responder preguntas de concurrencia con seguridad.
tags: [concurrencia, hilos, locks, mutex, deadlock, async, condiciones de carrera]
---

## Concurrencia vs. paralelismo

- **Concurrencia:** varias tareas **avanzan** en periodos que se traslapan (pueden turnarse en un solo núcleo).
- **Paralelismo:** varias tareas se **ejecutan al mismo tiempo** en núcleos distintos.

Un mesero atendiendo varias mesas es concurrencia; varios meseros atendiendo a la vez es paralelismo.

## Procesos e hilos

- **Proceso:** programa en ejecución con su **propio espacio de memoria**. Aislado: si uno falla, los demás siguen.
- **Hilo (thread):** unidad de ejecución dentro de un proceso. Los hilos de un mismo proceso **comparten memoria**, lo cual es eficiente y también peligroso.

JavaScript (en navegador y Node.js) ejecuta tu código en **un solo hilo con un bucle de eventos**: la concurrencia se logra con operaciones asíncronas (`Promise`, `async/await`) que no bloquean. Para paralelismo real existen los Web Workers (esta plataforma los usa para ejecutar tu código). Python tiene hilos, pero el GIL de CPython impide que ejecuten bytecode en paralelo; para cómputo intensivo se usan procesos (`multiprocessing`) y para E/S, `threading` o `asyncio`.

## Condición de carrera

Ocurre cuando el resultado depende del **orden impredecible** en que los hilos acceden a un dato compartido.

```
saldo = 100
Hilo A: lee saldo (100)          Hilo B: lee saldo (100)
Hilo A: escribe 100 + 50 = 150   Hilo B: escribe 100 - 30 = 70
Resultado final: 70  (¡se perdió el depósito!)
```

`saldo = saldo + 50` parece una sola operación, pero son tres: **leer, calcular, escribir**. Si otro hilo se mete en medio, hay problemas.

## Herramientas de sincronización

- **Mutex / lock:** sólo un hilo a la vez puede entrar a la **sección crítica**.
- **Semáforo:** permite hasta N hilos simultáneos (por ejemplo, un pool de 10 conexiones a base de datos).
- **Variables de condición:** un hilo espera hasta que otro le avise que algo cambió ("ya hay elementos en la cola").
- **Operaciones atómicas:** incrementos o comparar-e-intercambiar (CAS) garantizados por el hardware, sin lock.
- **Estructuras concurrentes:** colas y mapas seguros para hilos, provistos por la biblioteca estándar.

```python
import threading

saldo = 100
candado = threading.Lock()

def depositar(monto):
    global saldo
    with candado:            # sección crítica
        saldo = saldo + monto
```

## Deadlock (interbloqueo)

Dos o más hilos esperan para siempre recursos que tiene el otro. Se requieren **cuatro condiciones a la vez**:

1. **Exclusión mutua:** el recurso sólo puede usarlo uno a la vez.
2. **Retención y espera:** un hilo retiene un recurso mientras espera otro.
3. **Sin expropiación:** nadie puede quitarle el recurso a la fuerza.
4. **Espera circular:** A espera a B, B espera a A (o una cadena más larga).

Rompiendo **cualquiera** de ellas se previene. La técnica más práctica: **adquirir siempre los locks en el mismo orden global** (rompe la espera circular). Otras: usar tiempos límite al pedir un lock, o pedir todos los recursos de una vez.

## Otros problemas a conocer

- **Livelock:** los hilos no están bloqueados, pero reaccionan uno al otro sin avanzar (dos personas que se hacen a un lado en un pasillo, una y otra vez).
- **Inanición (starvation):** un hilo nunca obtiene el recurso porque otros siempre tienen prioridad.
- **Inversión de prioridad:** una tarea de baja prioridad retiene un lock que necesita una de alta prioridad.

## Patrón productor–consumidor

Productores agregan trabajo a una cola con capacidad limitada; consumidores lo sacan. Si la cola está llena, el productor espera; si está vacía, el consumidor espera. Es la base de los pools de hilos, los sistemas de colas y los pipelines de datos.

```python
from queue import Queue
from threading import Thread

cola = Queue(maxsize=10)     # segura para hilos

def productor():
    for i in range(100):
        cola.put(i)          # se bloquea si está llena

def consumidor():
    while True:
        tarea = cola.get()   # se bloquea si está vacía
        procesar(tarea)
        cola.task_done()
```

## Consejos para la entrevista

- Identifica explícitamente **qué datos son compartidos** y quién los modifica.
- Mantén las secciones críticas **lo más cortas posible**.
- Prefiere la inmutabilidad y el paso de mensajes antes que la memoria compartida con locks.
- Si propones un lock, explica cómo evitas el deadlock.
