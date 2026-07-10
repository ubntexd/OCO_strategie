// src/notify.js — stubs Phase 1 (CD §6 — Telegram/N8n branchés en Module C)

const notifyTelegram = async (message) => {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    return;
  }
  // Implémentation HTTP Telegram en Module C / health workflows
  void message;
};

const notifyN8n = async (path, payload) => {
  if (!process.env.N8N_WEBHOOK_BASE) {
    return;
  }
  void path;
  void payload;
};

module.exports = { notifyTelegram, notifyN8n };
