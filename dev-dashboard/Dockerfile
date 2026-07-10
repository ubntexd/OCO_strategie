FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --only=production
COPY dev-dashboard/ ./dev-dashboard/
EXPOSE 3020
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3020/health || exit 1
CMD ["node", "dev-dashboard/server.js"]
