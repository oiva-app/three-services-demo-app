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
COPY services/inventory/tsconfig.json services/inventory/tsconfig.build.json services/inventory/
COPY services/inventory/src services/inventory/src
RUN npm run build --workspace inventory
RUN npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/services/inventory/package.json ./services/inventory/package.json
COPY --from=build /app/services/inventory/dist ./services/inventory/dist
WORKDIR /app/services/inventory
USER node
EXPOSE 3001
CMD ["node", "dist/server.js"]