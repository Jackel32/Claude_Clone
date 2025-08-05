# ---- Stage 1: Build the application ----
FROM node:20-alpine AS builder

# Install build tools needed for native dependencies
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files and .npmrc
COPY package*.json .npmrc ./
# This install will use legacy-peer-deps to resolve conflicts
RUN npm install

# Copy the rest of your app's source code
COPY . .

RUN npm run build


# ---- Stage 2: Create the final production image ----
FROM node:20-alpine AS production

ENV NODE_ENV=production

# Install git, which is a runtime dependency for the git diff feature
RUN apk update && apk add git

WORKDIR /app

# Copy necessary artifacts from the builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Expose the port the server will run on
EXPOSE 3000

# The command to start the webserver
CMD ["node", "dist/server.js"]