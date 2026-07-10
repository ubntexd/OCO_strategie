FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --only=production
COPY mcp/ ./mcp/
EXPOSE 5010
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:5010/health || exit 1
CMD ["node", "mcp/server.js"]
