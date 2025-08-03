# ---- Stage 1: Build the application ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build


# ---- Stage 2: Create the final production image ----
FROM node:20-alpine AS production

ENV NODE_ENV=production

# Install git using the Alpine Linux package manager (apk)
RUN apk update && apk add git

WORKDIR /app

COPY --from=builder /app/package*.json ./

RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "dist/server.js"]