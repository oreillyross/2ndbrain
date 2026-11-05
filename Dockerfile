# Node deployment of 2ndBrain (Railway or any container host).
# The Cloudflare Worker deployment does not use this file.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build:web

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY migrations ./migrations
COPY tsconfig.json ./
# Mount a volume at /data so the SQLite file survives redeploys.
ENV TURSO_DATABASE_URL=file:/data/2ndbrain.db
EXPOSE 8080
CMD ["npx", "tsx", "server/node.ts"]
