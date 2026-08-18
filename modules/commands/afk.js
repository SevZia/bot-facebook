const axios = require("axios");

if (!global.afkData) global.afkData = new Map();

module.exports = {
  config: {
    name: "afk",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "Gemini",
    description: "Bật chế độ AFK, ghi lại lượt tag và tóm tắt cuộc trò chuyện khi quay lại",
    commandCategory: "Tiện ích",
    usages: "[Lý do]",
    cooldowns: 5
  },

  handleEvent: async function({ api, event }) {
    if (!event.body) return;

    // 1. Kiểm tra nếu người dùng AFK quay lại nhắn tin
    if (global.afkData.has(event.senderID)) {
      const data = global.afkData.get(event.senderID);
      global.afkData.delete(event.senderID);

      let msg = `👋 Chào mừng bạn quay lại!\n⏱️ Thời gian AFK: ${data.time}\n📝 Lý do: ${data.reason}`;

      if (data.mentions.length > 0) {
        msg += `\n\n📌 Bạn đã bị tag ${data.mentions.length} lần trong lúc AFK:\n`;
        data.mentions.forEach((m, i) => {
          msg += `${i + 1}. Từ người dùng ID ${m.author}: "${m.content}"\n`;
        });

        // Tóm tắt nội dung bằng Cloudflare AI
        const ACCOUNT_ID = "YOUR_CLOUDFLARE_ACCOUNT_ID";
        const API_TOKEN = "YOUR_CLOUDFLARE_API_TOKEN";

        if (ACCOUNT_ID !== "YOUR_CLOUDFLARE_ACCOUNT_ID") {
          try {
            const logsText = data.mentions.map(m => `Nội dung: ${m.content}`).join("\n");
            const res = await axios.post(
              `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/meta/llama-3-8b-instruct`,
              {
                messages: [
                  { role: "system", content: "Hãy tóm tắt ngắn gọn các tin nhắn sau bằng tiếng Việt:" },
                  { role: "user", content: logsText }
                ]
              },
              { headers: { Authorization: `Bearer ${API_TOKEN}` } }
            );
            msg += `\n💡 **Tóm tắt cuộc trò chuyện:**\n${res.data.result.response}`;
          } catch (e) {
            // Bỏ qua nếu chưa điền key AI
          }
        }
      } else {
        msg += `\n✨ Không có ai tag bạn trong lúc vắng mặt.`;
      }

      return api.sendMessage(msg, event.threadID, event.messageID);
    }

    // 2. Ghi lại khi có ai đó tag người đang AFK
    if (event.mentions && Object.keys(event.mentions).length > 0) {
      for (const [uid, name] of Object.entries(event.mentions)) {
        if (global.afkData.has(uid)) {
          const data = global.afkData.get(uid);
          data.mentions.push({
            author: event.senderID,
            content: event.body
          });
          api.sendMessage(`Thông báo: Người dùng ${name.replace("@", "")} hiện đang AFK với lý do: ${data.reason}`, event.threadID, event.messageID);
        }
      }
    }
  },

  run: async function({ api, event, args }) {
    const reason = args.join(" ") || "Không có lý do";
    const timeStr = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

    global.afkData.set(event.senderID, {
      reason: reason,
      time: timeStr,
      mentions: []
    });

    api.sendMessage(`✅ Đã bật chế độ AFK!\n📝 Lý do: ${reason}`, event.threadID, event.messageID);
  }
};