# CodePrep

Plataforma local para estudiar entrevistas técnicas y certificaciones: lecciones, repaso con repetición espaciada, ejercicios de código que se ejecutan en el navegador, simulacros de exámenes de certificación (AWS y más), tutor con IA, notas privadas o compartidas, guardados, índice con buscador y un visor para tu propio PDF.

## Requisitos

- Node.js 20 o superior
- (Opcional) Python 3, sólo para `npm run verify`

## Ejecutar en local

```bash
npm install            # instala dependencias, copia el worker de pdf.js y genera Prisma
npx prisma migrate deploy
npm run content:import # carga lecciones y cursos desde ./content a la base
npm run dev            # http://localhost:3000
```

Crea una cuenta en `/register`. Cada usuario tiene sus notas privadas, progreso, guardados y PDF.

### Acceso y administración

- Los usuarios de `ADMIN_USERNAMES` son administradores y su cuenta se aprueba sola al registrarse. **Crea tu cuenta de admin antes de compartir la URL**, para que nadie más registre ese nombre.
- Las demás cuentas quedan **pendientes** hasta que el admin las aprueba en **Configuración → Solicitudes de acceso**. Desde ahí también puede rechazar, bloquear (cierra sus sesiones al instante) o borrar cuentas no aprobadas.
- La **IA** (tutor y generación de cursos, preguntas y flashcards) sólo la ve y usa el admin, para controlar el gasto de la API.

### Activar la IA

Edita `.env`:

```
ANTHROPIC_API_KEY="sk-ant-..."
ANTHROPIC_MODEL="claude-opus-5-5"
```

Reinicia el servidor. Sin key, el resto de la app funciona igual y la sección de IA muestra un aviso (en Certificaciones sólo se desactiva crear cursos y generar preguntas/flashcards).

## Secciones

| Ruta | Qué hace |
|---|---|
| `/` | Resumen del progreso |
| `/index` | Índice completo y búsqueda en lecciones, ejercicios y notas |
| `/learn` | 15 lecciones con autoevaluación, notas por lección y chat con IA sobre el texto seleccionado |
| `/review` | Repetición espaciada (SM-2) con las preguntas que respondiste |
| `/practice` | 29 ejercicios con editor Monaco y pruebas en JavaScript o Python (Pyodide) |
| `/ask` | Tutor IA general |
| `/saved` | Lecciones, secciones, ejercicios y páginas del PDF guardadas |
| `/notes` | Mis notas y notas compartidas |
| `/book` | Visor de tu PDF con notas y marcadores por página |
| `/certs` | Buscador de cursos de certificación; crea cursos nuevos con IA |
| `/certs/[curso]` | Simulacro completo, examen personalizado por temas, retroalimentación, historial y generación de preguntas |
| `/certs/[curso]/exam/[id]` | Examen (modo práctica con corrección inmediata o modo examen con resultados al final) |
| `/certs/[curso]/results/[id]` | Retro del intento: puntaje, desglose por dominio/tema, qué estudiar y revisión pregunta por pregunta |
| `/certs/[curso]/flashcards` | Flashcards con repetición espaciada |
| `/certs/[curso]/questions` | Banco de preguntas: buscar, marcar pendientes, editar, agregar, generar con IA |
| `/certs/review` | Área de repaso: falladas vencidas, pendientes, temas débiles y preguntas que más olvidas |

## Certificaciones

Incluye bancos curados de **AWS Cloud Practitioner (CLF-C02)**, 210 preguntas, y **Solutions Architect Associate (SAA-C03)**, 200 preguntas, más 80 flashcards cada uno. Las preguntas son originales, de estilo escenario, y están repartidas según el peso oficial de cada dominio.

- **Simulacro**: 60 o 65 preguntas repartidas por peso de dominio, priorizando las que no has visto, con tiempo proporcional al examen real.
- **Examen personalizado**: elige temas (p. ej. S3 + EC2), cantidad, dificultad y si quieres sólo no vistas, falladas o pendientes. Si faltan preguntas, se generan con IA.
- **Dos modos**: *práctica* (corrección y explicación al responder) y *examen* (el servidor no envía las respuestas hasta terminar).
- Las preguntas se cargan en bloques de 10 y cada respuesta se guarda al instante, así que puedes cerrar y **reanudar**.
- Marca preguntas **para revisar** (dentro del intento) o como **pendientes** (persisten para estudiarlas después). También puedes **reportar** una pregunta con error.
- Al terminar, lo fallado entra al **repaso espaciado** (SM-2) y la retro calcula tus temas débiles y una **preparación estimada** ponderada por dominio.
- **Cursos nuevos con IA**: busca p. ej. "AZ-900"; si no existe, la IA arma dominios, pesos y temas y luego genera preguntas y flashcards en lotes de 10 (validadas y deduplicadas).

Si `ADMIN_USERNAMES` tiene usuarios, sólo ellos pueden editar/ocultar/borrar preguntas del banco; si está vacío, cualquiera puede.

### Agregar contenido curado

```
<contenido>/certs/<curso>/
  course.json               # meta, dominios (peso %, suman 100) y temas
  questions/batch-NN.json   # [{ id, domain, topics, stem, options, correct: [índices], explanation, notes?, difficulty }]
  flashcards/batch-NN.json  # [{ id, topic, front, back }]
```

```bash
npm run content:check   # valida los JSON (índices, duplicados, temas y dominios)
npm run content:import  # carga/actualiza en la base de datos
```

## Privacidad de datos

- Contraseñas con bcrypt; sesión con cookie `httpOnly`.
- Las notas `PRIVATE` sólo las devuelve la API a su autor; las `SHARED` las ve cualquier usuario autenticado y sólo su autor las edita o borra.
- El PDF de cada usuario se guarda en la base de datos (tabla `PdfBlob`) y sólo lo puede descargar su dueño.

## Contenido

El contenido (lecciones, quizzes, ejercicios y cursos de certificación) **no está en el repositorio ni en la imagen de Docker**: la app lo lee de la base de datos. Se mantiene en una carpeta aparte (por defecto `./content`, ignorada por git y Docker) y se carga con:

```bash
npm run content:import                  # desde ./content
npm run content:import -- --dir=<ruta>  # desde otra carpeta (o CONTENT_DIR=<ruta>)
```

La importación es una sincronización: las lecciones que ya no estén en la carpeta se borran de la base (el progreso de los usuarios se conserva).

Cada lección va en `<contenido>/lessons/NN-slug/`:

```
lesson.md            # markdown con frontmatter (title, order, summary, tags)
quiz.json            # [{ id, question, options, answer, explanation }]
problems/*.json      # enunciado, código inicial JS/Py, pruebas, pistas y solución
```

Para agregar una lección, crea una carpeta nueva con esa estructura y vuelve a importar. Los ejercicios con listas enlazadas o árboles usan `argAdapters` / `returnAdapter` (`"list"` o `"tree"`) para convertir arreglos a `ListNode` / `TreeNode`.

Verifica que todas las soluciones de referencia pasen sus pruebas:

```bash
npm run verify
```

## Docker

```bash
docker compose up --build   # http://localhost:3000
```

Todo (usuarios, contenido y PDFs) vive en la base SQLite del volumen `codeprep-data`. Si lo publicas detrás de HTTPS, pon `COOKIE_SECURE=true`.

La imagen arranca sin contenido. Para cargarlo (o actualizarlo) en el contenedor:

```bash
docker compose cp ./content codeprep:/tmp/content
docker compose exec codeprep npm run content:import -- --dir=/tmp/content
```

## Desplegar en Vercel (gratis)

En Vercel no hay disco persistente, así que la base va en **Turso** (SQLite en la nube) y los PDFs en **Vercel Blob** (privado). En local y en Docker no cambia nada: si no hay variables de Turso/Blob se usa el SQLite local.

1. **Turso**: crea una base en [turso.tech](https://turso.tech) (elige la región `aws-us-east-1`, cerca de Vercel) y copia su URL (`libsql://...`) y un token.
2. **Vercel**: importa el repo de GitHub. En *Settings → Environment Variables* agrega:
   `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ADMIN_USERNAMES` y `COOKIE_SECURE=true`.
3. **Blob**: en el proyecto de Vercel, *Storage → Create → Blob*, acceso **Private**, y conéctalo al proyecto (agrega `BLOB_READ_WRITE_TOKEN`).
4. **Deploy**: el script `vercel-build` aplica las migraciones en Turso (`scripts/migrate-turso.mjs`) y luego compila. Cada `git push` a `main` vuelve a desplegar.
5. **Contenido**: desde tu PC, con la carpeta `content/`:
   ```powershell
   $env:TURSO_DATABASE_URL="libsql://..."; $env:TURSO_AUTH_TOKEN="..."; npm run content:import
   ```
6. **Admin**: entra a la URL y registra tu usuario de `ADMIN_USERNAMES` antes de compartirla.

Los PDFs se suben directo del navegador a Blob y el visor los lee por rangos de ≤ 4 MB, porque las funciones de Vercel no aceptan ni devuelven más de 4.5 MB por petición.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Prisma + SQLite / Turso · Vercel Blob · Anthropic SDK (structured outputs) · Monaco Editor · Pyodide · pdf.js · Fuse.js
