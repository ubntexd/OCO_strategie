FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --only=production
COPY dashboard/ ./dashboard/
COPY src/correlation.js ./src/correlation.js
EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3010/health || exit 1
CMD ["node", "dashboard/server.js"]
