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
  if (!chatLogs || chatLogs.length === 0) return "Không có cuộc trò chuyện nào trong lúc vắng mặt.";
  
  const accountId = config?.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = config?.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) return "Chưa cấu hình API Cloudflare để tóm tắt.";

  const prompt = `Đây là các tin nhắn nhóm chat trong lúc chủ phòng vắng mặt:\n${chatLogs.join("\n")}\n\nHãy tóm tắt ngắn gọn 2-3 câu xem mọi người đã nói gì (dùng vài icon, phong cách Gen Z).`;

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
    name: "afk",
    version: "10.0.0",
    hasPermssion: 0,
    credits: "SevZia",
    description: "Bật AFK, báo lý do khi bị tag và tóm tắt bằng AI khi online",
    commandCategory: "Tiện ích",
    usages: "[lý do]",
    cooldowns: 2
  },

  // 1. Lệnh bật AFK
  run: async function ({ api, event, args }) {
    const { senderID, threadID, messageID } = event;
    const reason = args.join(" ") || "Không có lý do";
    const afkData = getAfkData();

    let name = "Huy";
    try {
      const userInfo = await api.getUserInfo(senderID);
      if (userInfo && userInfo[senderID]) name = userInfo[senderID].name;
    } catch (e) {}

    afkData[senderID] = {
      name: name,
      time: Date.now(),
      reason: reason,
      mentions: [],
      chatLogs: []
    };

    saveAfkData(afkData);
    return api.sendMessage(`✅ Đã bật chế độ AFK!\n📝 Lý do: ${reason}`, threadID, messageID);
  },

  // 2. Lắng nghe mọi tin nhắn trực tiếp trong Command
  handleEvent: async function ({ api, event, config }) {
    const { senderID, threadID, messageID, mentions, body } = event;
    if (!threadID || !body) return;

    const afkData = getAfkData();

    // A. Kiểm tra xem tin nhắn có tag/gọi tên ai đang AFK không
    let isTagMsg = false;
    for (const [afkUID, userAfk] of Object.entries(afkData)) {
      let isTagged = false;

      // 1. Bắt qua Mention xanh của FB
      if (mentions && Object.keys(mentions).length > 0 && mentions[afkUID]) {
        isTagged = true;
      }

      // 2. Bắt qua chuỗi văn bản (Tên FB, hoặc chữ "Huy", "Anh Huy", "@Anh Huy")
      const lowerBody = body.toLowerCase();
      if (!isTagged) {
        if (
          lowerBody.includes("huy") || 
          (userAfk.name && lowerBody.includes(userAfk.name.toLowerCase()))
        ) {
          isTagged = true;
        }
      }

      // Nếu phát hiện Tag / Gọi tên
      if (isTagged) {
        isTagMsg = true;

        let authorName = senderID === afkUID ? "Chính bạn" : "Thành viên";
        if (senderID !== afkUID) {
          try {
            const userInfo = await api.getUserInfo(senderID);
            if (userInfo && userInfo[senderID]) authorName = userInfo[senderID].name;
          } catch (e) {}
        }

        userAfk.mentions.push({ authorID: senderID, authorName: authorName, content: body });
        saveAfkData(afkData);

        // Phản hồi thông báo AFK ngay lập tức
        return api.sendMessage(`⚠️ ${userAfk.name} hiện đang AFK!\n📝 Lý do: ${userAfk.reason}`, threadID, messageID);
      } else if (senderID !== afkUID) {
        // Lưu tin nhắn nhóm cho AI tóm tắt
        let authorName = "Thành viên";
        try {
          const userInfo = await api.getUserInfo(senderID);
          if (userInfo && userInfo[senderID]) authorName = userInfo[senderID].name;
        } catch (e) {}
        userAfk.chatLogs.push(`${authorName}: ${body}`);
        saveAfkData(afkData);
      }
    }

    // B. Nếu người AFK nhắn một tin nhắn BÌNH THƯỜNG (không chứa chữ tag tên mình) -> Tắt AFK + Xuất Báo Cáo
    if (afkData[senderID] && !isTagMsg) {
      const userAfk = afkData[senderID];
      delete afkData[senderID];
      saveAfkData(afkData);

      const timeAfk = Math.floor((Date.now() - userAfk.time) / 1000);
      const minutes = Math.floor(timeAfk / 60);
      const seconds = timeAfk % 60;
      const timeStr = minutes > 0 ? `${minutes} phút ${seconds} giây` : `${seconds} giây`;

      let replyMsg = `👋 Chào mừng bạn quay lại!\n⏱️ Thời gian AFK: ${timeStr}\n📝 Lý do: ${userAfk.reason}\n\n`;

      if (userAfk.mentions && userAfk.mentions.length > 0) {
        replyMsg += `📌 Danh sách ${userAfk.mentions.length} tin nhắn tag bạn khi vắng mặt:\n`;
        userAfk.mentions.forEach((item, index) => {
          replyMsg += `${index + 1}. 👤 ${item.authorName}: "${item.content}"\n`;
        });
      } else {
        replyMsg += `✨ Không có ai tag bạn trong lúc vắng mặt.\n`;
      }

      api.sendMessage("🔍 Đang tóm tắt lại cuộc trò chuyện...", threadID, async (err, info) => {
        const summary = await summarizeChat(userAfk.chatLogs, config);
        if (info && info.messageID) api.unsendMessage(info.messageID, () => {});

        replyMsg += `\n📝 [ Tóm tắt cuộc trò chuyện ]:\n${summary}`;
        return api.sendMessage(replyMsg, threadID, messageID);
      });
    }
  }
};