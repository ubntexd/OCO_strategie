FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache curl git bash
RUN npm install -g @anthropic-ai/claude-code
COPY package*.json ./
RUN npm ci --only=production
EXPOSE 4099
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:4099/health || exit 1
CMD ["node", "scripts/claude-n8n-worker.js"]
