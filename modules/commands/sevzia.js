const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const statusPath = path.join(__dirname, '../../sevzia_status.json');

function getStatus() {
  if (!fs.existsSync(statusPath)) fs.writeFileSync(statusPath, '{}');
  try {
    return JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
  } catch (e) {
    return {};
  }
}

function saveStatus(data) {
  fs.writeFileSync(statusPath, JSON.stringify(data, null, 2));
}

module.exports = {
  config: {
    name: "sevzia",
    version: "1.3.0",
    hasPermssion: 0,
    credits: "SevZia",
    description: "Trò chuyện với Sevzia AI",
    commandCategory: "AI",
    usages: "[on/off/câu hỏi]",
    cooldowns: 2
  },

  run: async function ({ api, event, args }) {
    const { threadID, messageID } = event;
    const option = args[0] ? args[0].toLowerCase() : "";
    const aiStatus = getStatus();

    // 1. Xử lý BẬT AI
    if (option === "on") {
      aiStatus[threadID] = true;
      saveStatus(aiStatus);
      return api.sendMessage("🤖 Đã BẬT tính năng Sevzia AI cho nhóm này!", threadID, messageID);
    } 

    // 2. Xử lý TẮT AI
    if (option === "off") {
      aiStatus[threadID] = false;
      saveStatus(aiStatus);
      return api.sendMessage("🔕 Đã TẮT tính năng Sevzia AI cho nhóm này!", threadID, messageID);
    }

    // 3. Kiểm tra trạng thái TẮT
    if (aiStatus[threadID] === false) {
      return api.sendMessage("⚠️ Sevzia AI đang ở trạng thái TẮT. Dùng '/sevzia on' để bật lại nhé!", threadID, messageID);
    }

    const prompt = args.join(" ");
    if (!prompt) {
      return api.sendMessage("Dùng: /sevzia on (bật), /sevzia off (tắt) hoặc /sevzia [câu hỏi]", threadID, messageID);
    }

    // Gửi thông báo đang suy nghĩ
    const waitMsg = await new Promise((resolve) => {
      api.sendMessage("🔍 Sevzia đang suy nghĩ...", threadID, (err, info) => {
        resolve(info);
      }, messageID);
    });

    try {
      // Endpoint API AI dự phòng tốc độ cao
      const res = await axios.get(`https://deku-rest-api.dev/gemini?prompt=${encodeURIComponent(prompt)}`);
      const replyText = res.data?.gemini || res.data?.result || "Sevzia chưa suy nghĩ ra câu trả lời!";

      // Xóa tin nhắn "đang suy nghĩ" và trả lời
      if (waitMsg?.messageID) api.unsendMessage(waitMsg.messageID);
      return api.sendMessage(`🤖 [ Sevzia AI ]\n\n${replyText}`, threadID, messageID);

    } catch (error) {
      console.error("Lỗi Sevzia AI:", error.message);
      if (waitMsg?.messageID) api.unsendMessage(waitMsg.messageID);
      return api.sendMessage(`❌ Server AI hiện tại đang gặp sự cố kết nối, vui lòng thử lại sau!`, threadID, messageID);
    }
  }
};