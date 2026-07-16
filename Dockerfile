# Stage 1: Build stage for dependencies
FROM node:18-alpine AS builder

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY backend/package*.json ./

# Using npm ci is generally faster and more reliable for CI/CD
RUN npm ci

# Stage 2: Production image
FROM node:18-alpine AS production

# This is required so your worker can communicate with the host's Docker engine
# to run code in other containers.
RUN apk add --no-cache docker-cli

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

# Copy dependencies from base stage
COPY --from=builder /app/node_modules ./node_modules

# Copy app source
COPY backend/ .

# Expose port and start server
EXPOSE 5000

# Start the application using the npm start script
CMD [ "npm", "run", "start" ]