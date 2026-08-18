const fs = require('fs-extra');
const path = require('path');
const configPath = path.join(__dirname, '../../config.json');

module.exports = {
  config: {
    name: "sevzia",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "SevZia",
    description: "Bật/Tắt hoặc trò chuyện với Cloudflare AI",
    commandCategory: "AI",
    usages: "[on/off/câu hỏi]",
    cooldowns: 2
  },

  run: async function ({ api, event, args }) {
    const { threadID, messageID } = event;
    const option = args[0] ? args[0].toLowerCase() : "";

    // Xử lý bật/tắt
    if (option === "on") {
      global.sevziaAIStatus = global.sevziaAIStatus || {};
      global.sevziaAIStatus[threadID] = true;
      return api.sendMessage("🤖 Đã BẬT tính năng trả lời tự động Sevzia AI cho nhóm này!", threadID, messageID);
    } 
    
    if (option === "off") {
      global.sevziaAIStatus = global.sevziaAIStatus || {};
      global.sevziaAIStatus[threadID] = false;
      return api.sendMessage("🔕 Đã TẮT tính năng trả lời tự động Sevzia AI cho nhóm này!", threadID, messageID);
    }

    // Kiểm tra trạng thái nếu chỉ nhắn câu hỏi
    global.sevziaAIStatus = global.sevziaAIStatus || {};
    if (global.sevziaAIStatus[threadID] === false) {
      return api.sendMessage("⚠️ AI Sevzia đang ở trạng thái TẮT. Dùng '/sevzia on' để bật lại nhé!", threadID, messageID);
    }

    const prompt = args.join(" ");
    if (!prompt) return api.sendMessage("Dùng: /sevzia on (để bật), /sevzia off (để tắt) hoặc /sevzia [câu hỏi]", threadID, messageID);

    // Gọi Cloudflare AI (giữ nguyên phần gọi API của bạn ở đây)
    api.sendMessage("🔍 Sevzia đang suy nghĩ...", threadID, messageID);
    // ... code gọi Cloudflare AI hiện tại của bạn ...
  }
};