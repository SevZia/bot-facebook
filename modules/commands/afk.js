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

  const prompt = `Đây là nội dung các tin nhắn trong nhóm chat:\n${chatLogs.join("\n")}\n\nHãy tóm tắt ngắn gọn 2-3 câu nội dung mọi người đã trao đổi (phong cách Gen Z).`;

  try {
    const res = await axios.post(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        messages: [
          { role: "system", content: "Bạn là trợ lý tóm tắt trung thực, ngắn gọn." },
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
    version: "15.0.0",
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
      threadID: threadID,
      time: Date.now(),
      reason: reason,
      mentions: [],
      chatLogs: []
    };

    saveAfkData(afkData);
    return api.sendMessage(`✅ Đã bật chế độ AFK!\n📝 Lý do: ${reason}`, threadID, messageID);
  },

  // 2. Lắng nghe sự kiện tin nhắn
  handleEvent: async function ({ api, event, config }) {
    const { senderID, threadID, messageID, mentions, body } = event;
    if (!threadID || !body) return;

    // Bỏ qua các tin nhắn là câu lệnh (bắt đầu bằng / hoặc !)
    if (body.startsWith("/") || body.startsWith("!")) return;

    const afkData = getAfkData();

    // A. KIỂM TRA TIN NHẮN CÓ CHỨA CÂU TAG / TÊN CỦA BẤT KỲ AI ĐANG AFK
    for (const [afkUID, userAfk] of Object.entries(afkData)) {
      if (userAfk.threadID !== threadID) continue;

      let isTagged = false;

      // Check 1: Mention xanh FB
      if (mentions && Object.keys(mentions).length > 0 && mentions[afkUID]) {
        isTagged = true;
      }

      // Check 2: Chữ viết chứa tên ("huy", "anh huy", "@anh huy", "@alo",...)
      const lowerBody = body.toLowerCase();
      if (!isTagged) {
        if (
          lowerBody.includes("huy") || 
          lowerBody.includes("@alo") ||
          (userAfk.name && lowerBody.includes(userAfk.name.toLowerCase()))
        ) {
          isTagged = true;
        }
      }

      // NẾU PHÁT HIỆN CÓ CÂU TAG (Dù là người khác tag hay chính chủ tự tag)
      if (isTagged) {
        let authorName = senderID === afkUID ? "Chính bạn" : "Thành viên";
        if (senderID !== afkUID) {
          try {
            const userInfo = await api.getUserInfo(senderID);
            if (userInfo && userInfo[senderID]) authorName = userInfo[senderID].name;
          } catch (e) {}
        }

        userAfk.mentions.push({ authorID: senderID, authorName: authorName, content: body });
        saveAfkData(afkData);

        // Trả lời phản hồi báo lý do AFK lập tức
        return api.sendMessage(`⚠️ ${userAfk.name} hiện đang AFK!\n📝 Lý do: ${userAfk.reason}`, threadID, messageID);
      } else {
        // Lưu lại tin nhắn nhóm để AI tóm tắt
        let authorName = "Thành viên";
        try {
          const userInfo = await api.getUserInfo(senderID);
          if (userInfo && userInfo[senderID]) authorName = userInfo[senderID].name;
        } catch (e) {}
        userAfk.chatLogs.push(`${authorName}: ${body}`);
        saveAfkData(afkData);
      }
    }

    // B. NẾU CHÍNH NGƯỜI BẬT AFK NHẮN CÂU NÓI BÌNH THƯỜNG (Ví dụ: "Uh") -> TẮT AFK & GỬI BÁO CÁO
    if (afkData[senderID] && afkData[senderID].threadID === threadID) {
      // Tránh tự kích hoạt tắt ngay khi vừa bật AFK (chờ ít nhất 2 giây)
      if (Date.now() - afkData[senderID].time < 2000) return;

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

      if (!userAfk.chatLogs || userAfk.chatLogs.length === 0) {
        replyMsg += `\n📝 [ Tóm tắt cuộc trò chuyện ]:\nKhông có cuộc trò chuyện nào trong lúc vắng mặt.`;
        return api.sendMessage(replyMsg, threadID, messageID);
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