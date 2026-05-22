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
COPY services/orders/tsconfig.json services/orders/tsconfig.build.json services/orders/
COPY services/orders/src services/orders/src
RUN npm run build --workspace orders
RUN npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
ARG SERVICE_VERSION=unknown
ENV SERVICE_VERSION=$SERVICE_VERSION
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/services/orders/package.json ./services/orders/package.json
COPY --from=build /app/services/orders/dist ./services/orders/dist
WORKDIR /app/services/orders
USER node
EXPOSE 3002
CMD ["node", "dist/server.js"]