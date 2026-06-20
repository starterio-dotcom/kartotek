# Kartotékrendszer web — éles kép: Vite-build → statikus kiszolgálás nginx-szel.
# A build-kontextus a repó GYÖKERE: `docker build -f apps/web/Dockerfile .`

FROM node:20-slim AS build
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter "@kartotek/web..."
# Éles módban az API az nginx /api alatt, ugyanazon az originon (lásd nginx.conf).
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
# A Vite éles buildje a shared `default` (dist) feltételét oldja fel → előbb shared build.
RUN pnpm --filter "@kartotek/shared" build \
 && pnpm --filter @kartotek/web build

FROM nginx:1.27-alpine AS run
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
