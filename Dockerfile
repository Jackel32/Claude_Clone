# ---- Stage 1: Build the application ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build


# ---- Stage 2: Create the final production image ----
FROM node:20-alpine AS production

# FIX: Set the Node.js environment to 'production'
ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app/package*.json ./

RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "dist/server.js"]