# Kartotékrendszer API — éles kép.
# A `@kartotek/shared`-et a build dist-re fordítja, az API tiszta `node`-dal fut
# (a shared `exports.default` → dist; dev/teszt a `development` feltétellel a forrást
# használja). A build-kontextus a repó GYÖKERE: `docker build -f apps/api/Dockerfile .`

FROM node:20-slim
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY . .
# Az API + függőségei (shared) telepítése, majd shared → dist és API → dist.
RUN pnpm install --frozen-lockfile --filter "@kartotek/api..." \
 && pnpm --filter "@kartotek/shared" build \
 && pnpm --filter "@kartotek/api" build

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/server.js"]
