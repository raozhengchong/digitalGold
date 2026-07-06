# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
ARG BACKEND_URL=http://localhost:9000
ARG STOREFRONT_URL=http://localhost:8000
ENV BACKEND_URL=${BACKEND_URL}
ENV STOREFRONT_URL=${STOREFRONT_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN NODE_ENV=production yarn build

FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable

ENV NODE_ENV=production

COPY package.json yarn.lock .yarnrc.yml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.medusa ./.medusa
COPY --from=builder /app/.medusa/server/public ./public
COPY --from=builder /app/medusa-config.js ./
COPY --from=builder /app/instrumentation.js ./
COPY --from=builder /app/tsconfig.json ./
# Custom API routes require src/ at runtime (Medusa 2)
COPY --from=builder /app/src ./src
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh && ln -s /app/src /src

EXPOSE 9000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["yarn", "start"]
