const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const statusPath = path.join(__dirname, '../../sevzia_status.json');

function getStatus() {
  if (!fs.existsSync(statusPath)) fs.writeFileSync(statusPath, '{}');
  try { return JSON.parse(fs.readFileSync(statusPath, 'utf-8')); } catch (e) { return {}; }
}

function saveStatus(data) {
  fs.writeFileSync(statusPath, JSON.stringify(data, null, 2));
}

module.exports = {
  config: {
    name: "sevzia",
    version: "2.3.0",
    hasPermssion: 0,
    credits: "SevZia",
    description: "Trò chuyện với Cloudflare AI",
    commandCategory: "AI",
    usages: "[on/off/câu hỏi]",
    cooldowns: 2
  },

  run: async function ({ api, event, args, config }) {
    const { threadID, messageID } = event;
    const option = args[0] ? args[0].toLowerCase() : "";
    const aiStatus = getStatus();

    if (option === "on") {
      aiStatus[threadID] = true;
      saveStatus(aiStatus);
      return api.sendMessage("🤖 Đã BẬT tính năng Sevzia AI cho nhóm này!", threadID, messageID);
    } 

    if (option === "off") {
      aiStatus[threadID] = false;
      saveStatus(aiStatus);
      return api.sendMessage("🔕 Đã TẮT tính năng Sevzia AI cho nhóm này!", threadID, messageID);
    }

    if (aiStatus[threadID] === false) {
      return api.sendMessage("⚠️ Sevzia AI đang ở trạng thái TẮT. Dùng '/sevzia on' để bật lại nhé!", threadID, messageID);
    }

    const prompt = args.join(" ");
    if (!prompt) {
      return api.sendMessage("Dùng: /sevzia on (bật), /sevzia off (tắt) hoặc /sevzia [câu hỏi]", threadID, messageID);
    }

    const accountId = config.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = config.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      return api.sendMessage("❌ Thiếu CLOUDFLARE_ACCOUNT_ID hoặc CLOUDFLARE_API_TOKEN trong config.json!", threadID, messageID);
    }

    let waitMsg = null;
    try {
      waitMsg = await new Promise((resolve) => {
        api.sendMessage("🔍 Sevzia đang suy nghĩ...", threadID, (err, info) => resolve(info), messageID);
      });
    } catch (e) {}

    try {
      const res = await axios.post(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
        {
          messages: [
            { role: "system", content: "Bạn là Sevzia AI, một trợ lý thông minh và thân thiện." },
            { role: "user", content: prompt }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json"
          }
        }
      );

      const replyText = res.data?.result?.response || "Không nhận được phản hồi từ Cloudflare AI.";

      if (waitMsg) {
        api.unsendMessage(waitMsg);
      }
      return api.sendMessage(`🤖 [ Sevzia AI ]\n\n${replyText}`, threadID, messageID);

    } catch (error) {
      console.error("Lỗi Cloudflare AI:", error.response?.data || error.message);
      if (waitMsg) {
        api.unsendMessage(waitMsg);
      }
      return api.sendMessage(`❌ Lỗi kết nối Cloudflare AI: ${error.message}`, threadID, messageID);
    }
  }
};