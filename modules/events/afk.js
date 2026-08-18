const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const afkPath = path.join(__dirname, '../../afk_data.json');

function getAfkData() {
  if (!fs.existsSync(afkPath)) fs.writeFileSync(afkPath, '{}');
  try { return JSON.parse(fs.readFileSync(afkPath, 'utf-8')); } catch (e) { return {}; }
}

function saveAfkData(data) {
  fs.writeFileSync(afkPath, JSON.stringify(data, null, 2));
}

async function summarizeChat(chatLogs, config) {
  if (!chatLogs || chatLogs.length === 0) return "Không có cuộc trò chuyện nào trong lúc bạn vắng mặt.";
  
  const accountId = config?.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = config?.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) return "Chưa cấu hình API Cloudflare để tóm tắt.";

  const prompt = `Đây là tin nhắn nhóm chat trong lúc chủ phòng vắng mặt:\n${chatLogs.join("\n")}\n\nHãy tóm tắt ngắn gọn 2-3 câu xem mọi người đã nói gì (dùng vài icon, style Gen Z).`;

  try {
    const res = await axios.post(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        messages: [
          { role: "system", content: "Bạn là trợ lý tóm tắt tin nhắn ngắn gọn." },
          { role: "user", content: prompt }
        ]
      },
      { headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" } }
    );
    return res.data?.result?.response || "Không thể tóm tắt cuộc trò chuyện.";
  } catch (e) {
    return "Lỗi AI tóm tắt.";
  }
}

module.exports = {
  config: {
    name: "afk_event",
    eventType: ["message", "message_reply"],
    version: "8.0.0",
    credits: "SevZia",
    description: "Lắng nghe sự kiện AFK"
  },

  run: async function ({ api, event, config }) {
    const { senderID, threadID, messageID, mentions, body } = event;
    if (!threadID || !body) return;

    const afkData = getAfkData();

    // 1. Khi người AFK nhắn tin trở lại (Tắt AFK + Trả về danh sách tag + AI Tóm tắt)
    if (afkData[senderID]) {
      const myName = afkData[senderID].name || "";
      if (body.toLowerCase().includes(myName.toLowerCase()) && body.startsWith("@")) return;

      const userAfk = afkData[senderID];
      delete afkData[senderID];
      saveAfkData(afkData);

      const timeAfk = Math.floor((Date.now() - userAfk.time) / 1000);
      const minutes = Math.floor(timeAfk / 60);
      const seconds = timeAfk % 60;
      const timeStr = minutes > 0 ? `${minutes} phút ${seconds} giây` : `${seconds} giây`;

      let replyMsg = `👋 Chào mừng bạn quay lại!\n⏱️ Thời gian AFK: ${timeStr}\n📝 Lý do: ${userAfk.reason}\n\n`;

      if (userAfk.mentions && userAfk.mentions.length > 0) {
        replyMsg += `📌 Tin nhắn tag bạn khi vắng mặt (${userAfk.mentions.length}):\n`;
        userAfk.mentions.forEach((item, index) => {
          replyMsg += `${index + 1}. 👤 ${item.authorName}: "${item.content}"\n`;
        });
      } else {
        replyMsg += `✨ Không có ai tag bạn trong lúc vắng mặt.\n`;
      }

      api.sendMessage("🔍 Đang tóm tắt lại cuộc trò chuyện lúc bạn vắng mặt...", threadID, async (err, info) => {
        const summary = await summarizeChat(userAfk.chatLogs, config);
        if (info && info.messageID) api.unsendMessage(info.messageID, () => {});

        replyMsg += `\n📝 [ Tóm tắt cuộc trò chuyện ]:\n${summary}`;
        return api.sendMessage(replyMsg, threadID, messageID);
      });

      return;
    }

    // 2. Khi người khác nhắn tin / tag người đang AFK
    for (const [afkUID, userAfk] of Object.entries(afkData)) {
      if (senderID === afkUID) continue;

      let authorName = "Thành viên";
      try {
        const userInfo = await api.getUserInfo(senderID);
        if (userInfo && userInfo[senderID]) authorName = userInfo[senderID].name;
      } catch (e) {}

      // Lưu nhật ký chat
      userAfk.chatLogs.push(`${authorName}: ${body}`);

      // Kiểm tra tag
      let isTagged = false;
      if (mentions && Object.keys(mentions).length > 0 && mentions[afkUID]) isTagged = true;
      if (!isTagged && userAfk.name && body.toLowerCase().includes(userAfk.name.toLowerCase())) isTagged = true;

      if (isTagged) {
        userAfk.mentions.push({ authorID: senderID, authorName: authorName, content: body });
        api.sendMessage(`⚠️ ${userAfk.name} hiện đang AFK!\n📝 Lý do: ${userAfk.reason}`, threadID, messageID);
      }

      saveAfkData(afkData);
    }
  }
};