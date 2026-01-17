# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for both server and client
COPY package*.json ./
COPY client/package*.json ./client/

RUN npm ci
RUN cd client && npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build client and server
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist

# Create uploads directory
RUN mkdir -p uploads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
