FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE ${PORT}
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1
CMD ["node", "src/bot.js"]
