# ---- Stage 1: Build the application ----
FROM node:20-alpine AS builder

# Install build tools and git, which is a runtime dependency
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files
COPY package*.json .npmrc ./
# Install dependencies
RUN npm install --legacy-peer-deps

# Copy the rest of the app's source code
COPY . .

# Build the TypeScript code into JavaScript
RUN npm run build

# ---- Stage 2: Create the final, lean image ----
FROM node:20-alpine AS production

ENV NODE_ENV=production

# Install git, which is a runtime dependency for some agent tasks
RUN apk update && apk add --no-cache git

WORKDIR /app

# Copy only the necessary artifacts from the builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# The command to start the interactive CLI menu
CMD ["node", "dist/index.js"]