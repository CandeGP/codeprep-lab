---
title: Diseño de sistemas y escalabilidad
order: 10
summary: Un marco para responder "diseña un acortador de URLs" o "diseña un feed", con los bloques de construcción que todo ingeniero debería poder explicar.
tags: [diseño de sistemas, escalabilidad, caché, base de datos, balanceo, sharding, colas]
---

## Qué buscan en esta entrevista

No existe "la" respuesta correcta. Se evalúa si puedes **razonar sobre compromisos** (costo, latencia, consistencia, complejidad), comunicarte con claridad y **conducir** la conversación. Hablar de más con términos de moda sin justificarlos resta puntos.

## Marco en 6 pasos

1. **Requisitos funcionales.** ¿Qué hace el sistema? Enumera 3–5 capacidades esenciales. Ejemplo para un acortador de URLs: crear enlace corto, redirigir, (opcional) estadísticas, expiración.
2. **Requisitos no funcionales.** Escala, latencia, disponibilidad, consistencia, seguridad. ¿Es más importante no perder datos o responder rápido?
3. **Estimaciones rápidas.** Ordenes de magnitud, no precisión:
   - 100 millones de enlaces nuevos al mes ≈ 40 escrituras/segundo.
   - Si las lecturas son 100× las escrituras → ≈ 4,000 lecturas/segundo.
   - 500 bytes por registro × 100 M × 12 meses × 5 años ≈ 3 TB.
4. **Diseño de alto nivel.** Dibuja cajas: clientes → balanceador → servidores de aplicación → caché → base de datos. Explica el flujo de una petición de principio a fin.
5. **Profundiza en los componentes críticos.** El esquema de datos, cómo generar IDs únicos, dónde está el cuello de botella.
6. **Identifica fallas y mejoras.** ¿Qué pasa si se cae un servidor? ¿Si una clave se vuelve muy popular? ¿Cómo monitoreas?

## Bloques de construcción

### Escalamiento vertical vs. horizontal

- **Vertical:** una máquina más grande. Simple, pero tiene techo y es un único punto de falla.
- **Horizontal:** más máquinas. Requiere que los servidores de aplicación sean **sin estado** (la sesión vive en una caché o base de datos compartida).

### Balanceador de carga

Reparte el tráfico entre servidores (round-robin, menos conexiones, hash por usuario) y deja de enviar tráfico a servidores caídos gracias a **health checks**.

### Caché

Guarda en memoria resultados costosos (Redis, Memcached, CDN para archivos estáticos).

- **Cache-aside:** la aplicación busca en caché; si no está, lee de la base de datos y la guarda.
- **Invalidación:** el problema difícil. Opciones: TTL (expira sola), invalidar al escribir, o aceptar datos ligeramente viejos.
- **Políticas de expulsión:** LRU, LFU.

### Bases de datos

- **Relacionales (SQL):** esquemas, transacciones ACID, joins. Excelentes por defecto.
- **NoSQL:** clave-valor, documentos, columnas anchas, grafos. Escalan horizontalmente con más facilidad a cambio de consultas más limitadas o consistencia eventual.
- **Réplicas de lectura:** una primaria recibe escrituras; réplicas atienden lecturas. Cuidado con el retraso de replicación.
- **Particionamiento (sharding):** repartir los datos entre varias bases por una clave (usuario, región, hash). Elige una clave que distribuya bien y evite "hot spots". El *hashing consistente* minimiza cuántos datos se mueven al agregar nodos.
- **Índices:** aceleran lecturas (O(log n) con árboles B) a cambio de escrituras más lentas y más espacio.

### Colas de mensajes

Desacoplan productores y consumidores (Kafka, RabbitMQ, SQS). Permiten procesar trabajo pesado en segundo plano (enviar correos, generar miniaturas), absorber picos de tráfico y reintentar fallas.

### Teorema CAP (versión útil)

Ante una partición de red, un sistema distribuido debe elegir entre **consistencia** (todos ven el mismo dato) y **disponibilidad** (siempre responde). Un banco suele priorizar consistencia; un contador de "me gusta", disponibilidad.

## Ejemplo resumido: acortador de URLs

- **API:** `POST /links {url}` → `{codigo}`; `GET /{codigo}` → redirección 301/302.
- **Generar códigos:** codificar en base62 un ID autoincremental o de un generador distribuido. 7 caracteres base62 ≈ 3.5 billones de combinaciones. Alternativa: hash de la URL con manejo de colisiones.
- **Datos:** tabla `links(codigo PK, url, creado, expira, usuario)`. Clave-valor encaja perfecto.
- **Lecturas masivas:** caché delante de la base de datos; los enlaces populares casi nunca llegan a la base.
- **Estadísticas:** registrar cada clic en una cola y agregarlos de forma asíncrona, para no frenar la redirección.

## Frases que ayudan

- "Voy a asumir X; si no es así, el diseño cambiaría en Y."
- "El cuello de botella aquí probablemente sea…"
- "Podemos empezar simple con una sola base de datos y particionar cuando…"
- "La compensación es: ganamos latencia pero aceptamos datos con hasta N segundos de retraso."
