FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:24-alpine AS production
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# app compilado (inclui dist/generated/prisma)
COPY --from=builder /app/dist ./dist

# prisma CLI precisa do schema + migrations + config
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/keys ./keys

RUN mkdir -p /app/uploads

EXPOSE 3000
CMD ["node", "dist/src/main.js"]
