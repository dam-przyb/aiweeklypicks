# syntax=docker/dockerfile:1.7

############################################
# BUILD STAGE
############################################
FROM node:22.14.0-alpine AS BUILDER

ARG PUBLIC_ENV_NAME=local

LABEL org.opencontainers.image.title="aiweeklypicks" \
      org.opencontainers.image.description="AI Weekly Picks - Astro + React app (build)" \
      org.opencontainers.image.source="https://github.com/dam-przyb/aiweeklypicks"

ENV NODE_ENV=development \
    PUBLIC_ENV_NAME=${PUBLIC_ENV_NAME}

WORKDIR /app

# Install any OS-level dependencies here if they become necessary.
# RUN apk add --no-cache libc6-compat

# Install dependencies in a separate layer for better caching.
COPY package.json ./
# If a lockfile is added later, uncomment the appropriate COPY and adjust install command.
# COPY package-lock.json ./
# COPY pnpm-lock.yaml ./
# COPY bun.lockb ./

RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy the rest of the source and build the app.
COPY . .

RUN npm run build


############################################
# RUNTIME STAGE
############################################
FROM node:22.14.0-alpine AS RUNTIME

ARG PUBLIC_ENV_NAME=local

LABEL org.opencontainers.image.title="aiweeklypicks" \
      org.opencontainers.image.description="AI Weekly Picks - Astro + React app (runtime)" \
      org.opencontainers.image.source="https://github.com/dam-przyb/aiweeklypicks"

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    PUBLIC_ENV_NAME=${PUBLIC_ENV_NAME}

WORKDIR /app

# Create and use a non-root user for security.
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

# Copy only what is needed for runtime from the build stage.
COPY --from=BUILDER /app/dist ./dist
COPY --from=BUILDER /app/node_modules ./node_modules
COPY --from=BUILDER /app/package.json ./package.json

RUN chown -R nodeuser:nodejs /app
USER nodeuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node ./dist/server/entry.mjs --help >/dev/null 2>&1 || exit 1

CMD ["node", "./dist/server/entry.mjs"]


