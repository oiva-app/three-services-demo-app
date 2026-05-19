FROM node:22-alpine AS build
WORKDIR /app
# Copy all workspace manifests — npm workspaces resolves them at install time
COPY package.json package-lock.json tsconfig.base.json ./
COPY services/gateway/package.json services/gateway/
COPY services/orders/package.json services/orders/
COPY services/inventory/package.json services/inventory/
COPY services/loadgen/package.json services/loadgen/
RUN npm ci
# Copy source for this service only
COPY services/loadgen/tsconfig.json services/loadgen/tsconfig.build.json services/loadgen/
COPY services/loadgen/src services/loadgen/src
RUN npm run build --workspace loadgen
RUN npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/services/loadgen/package.json ./services/loadgen/package.json
COPY --from=build /app/services/loadgen/dist ./services/loadgen/dist
WORKDIR /app/services/loadgen
USER node
CMD ["node", "dist/main.js"]