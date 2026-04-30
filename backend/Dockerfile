# syntax=docker/dockerfile:1.7

# ---------- deps ----------
# Production-only node_modules, isolated so it can be cached and copied
# directly into the runtime image without another npm install.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- build ----------
# Full install (incl. dev deps) and TypeScript compile to dist/.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# dumb-init handles PID 1 signal forwarding and zombie reaping
RUN apk add --no-cache dumb-init

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist         ./dist
COPY package.json ./

# Run as the non-root `node` user that ships with the alpine image
USER node

EXPOSE 3000

# Liveness probe: any HTTP response < 500 means the server is alive.
# Connection refused = the failure mode.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
