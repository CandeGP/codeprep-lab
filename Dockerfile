# ---------- dependencias ----------
FROM node:22-slim AS deps
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN npm ci

# ---------- build ----------
FROM deps AS build
COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:22-slim AS runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL="file:/app/data/codeprep.db"
COPY --from=build /app ./
RUN mkdir -p /app/data /app/storage/pdf
VOLUME ["/app/data", "/app/storage"]
EXPOSE 3000
# Aplica migraciones pendientes, carga los cursos de certificación y arranca el servidor
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx scripts/seed-certs.ts && npx next start -p ${PORT}"]
