FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache curl git bash
COPY package*.json ./
RUN npm ci --only=production
EXPOSE 5011
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:5011/health || exit 1
CMD ["node", "mcp/http-bridge.js"]
