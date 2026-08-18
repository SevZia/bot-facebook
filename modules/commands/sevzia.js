const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const statusPath = path.join(__dirname, '../../sevzia_status.json');

// Hàm đọc trạng thái bật/tắt từ file
function getStatus() {
  if (!fs.existsSync(statusPath)) fs.writeFileSync(statusPath, '{}');
  try {
    return JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
  } catch (e) {
    return {};
  }
}

// Hàm lưu trạng thái vào file
function saveStatus(data) {
  fs.writeFileSync(statusPath, JSON.stringify(data, null, 2));
}

module.exports = {
  config: {
    name: "sevzia",
    version: "1.1.0",
    hasPermssion: 0,
    credits: "SevZia",
    description: "Bật/Tắt hoặc trò chuyện với Cloudflare AI",
    commandCategory: "AI",
    usages: "[on/off/câu hỏi]",
    cooldowns: 2
  },

  run: async function ({ api, event, args, config }) {
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

    // 3. Kiểm tra nếu nhóm đang bị TẮT
    if (aiStatus[threadID] === false) {
      return api.sendMessage("⚠️ Sevzia AI đang ở trạng thái TẮT. Dùng '/sevzia on' để bật lại nhé!", threadID, messageID);
    }

    const prompt = args.join(" ");
    if (!prompt) {
      return api.sendMessage("Dùng: /sevzia on (bật), /sevzia off (tắt) hoặc /sevzia [câu hỏi]", threadID, messageID);
    }

    // Send thông báo đang xử lý
    api.sendMessage("🔍 Sevzia đang suy nghĩ...", threadID, async (err, info) => {
      try {
        // Lấy thông tin Cloudflare từ config.json hoặc dùng API Public
        const accountId = config?.CLOUDFLARE_ACCOUNT_ID;
        const apiToken = config?.CLOUDFLARE_API_TOKEN;

        let replyText = "";

        if (accountId && apiToken) {
          // Trường hợp 1: Gọi Cloudflare Workers AI chính chủ
          const response = await axios.post(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3-8b-instruct`,
            { messages: [{ role: "user", content: prompt }] },
            { headers: { Authorization: `Bearer ${apiToken}` } }
          );
          replyText = response.data?.result?.response || "Không nhận được phản hồi từ AI.";
        } else {
          // Trường hợp 2: Gọi API AI miễn phí dự phòng (nếu không cài Cloudflare Key)
          const response = await axios.get(`https://api.simsimi.vn/v1/simtalk`, {
            params: { text: prompt, lc: "vn" }
          });
          replyText = response.data?.message || "Lỗi kết nối Server AI!";
        }

        // Xóa tin nhắn "đang suy nghĩ" và gửi câu trả lời
        if (info?.messageID) api.unsendMessage(info.messageID);
        return api.sendMessage(`🤖 [ Sevzia AI ]\n\n${replyText}`, threadID, messageID);

      } catch (error) {
        console.error("Lỗi Sevzia AI:", error.message);
        if (info?.messageID) api.unsendMessage(info.messageID);
        return api.sendMessage(`❌ Lỗi kết nối AI: ${error.message}`, threadID, messageID);
      }
    }, messageID);
  }
};