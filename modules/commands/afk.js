const fs = require('fs-extra');
const path = require('path');

const afkPath = path.join(__dirname, '../../afk_data.json');

function getAfkData() {
  if (!fs.existsSync(afkPath)) fs.writeFileSync(afkPath, '{}');
  try { return JSON.parse(fs.readFileSync(afkPath, 'utf-8')); } catch (e) { return {}; }
}

function saveAfkData(data) {
  fs.writeFileSync(afkPath, JSON.stringify(data, null, 2));
}

module.exports = {
  config: {
    name: "afk",
    version: "4.0.0",
    hasPermssion: 0,
    credits: "SevZia",
    description: "Tự động ghi nhận danh sách tin nhắn khi bị tag lúc AFK",
    commandCategory: "Tiện ích",
    usages: "[lý do]",
    cooldowns: 2
  },

  run: async function ({ api, event, args }) {
    const { senderID, threadID, messageID } = event;
    const reason = args.join(" ") || "Không có lý do";
    const afkData = getAfkData();

    // Lấy tên người dùng để quét text tag
    let name = "Anh Huy";
    try {
      const userInfo = await api.getUserInfo(senderID);
      if (userInfo && userInfo[senderID]) name = userInfo[senderID].name;
    } catch (e) {}

    afkData[senderID] = {
      name: name,
      time: Date.now(),
      reason: reason,
      mentions: []
    };

    saveAfkData(afkData);
    return api.sendMessage(`✅ Đã bật chế độ AFK!\n📝 Lý do: ${reason}`, threadID, messageID);
  },

  handleEvent: async function ({ api, event }) {
    const { senderID, threadID, messageID, mentions, body } = event;
    if (!threadID || !body) return;

    const afkData = getAfkData();

    // 1. Nếu người AFK nhắn tin KHÔNG PHẢI câu tag/kiểm tra -> Tắt AFK & Thống kê
    if (afkData[senderID] && !body.toLowerCase().includes(afkData[senderID].name.toLowerCase())) {
      const userAfk = afkData[senderID];
      const timeAfk = Math.floor((Date.now() - userAfk.time) / 1000);
      const minutes = Math.floor(timeAfk / 60);
      const seconds = timeAfk % 60;
      const timeStr = minutes > 0 ? `${minutes} phút ${seconds} giây` : `${seconds} giây`;

      let replyMsg = `👋 Chào mừng bạn quay lại!\n⏱️ Thời gian AFK: ${timeStr}\n📝 Lý do: ${userAfk.reason}\n\n`;

      if (userAfk.mentions && userAfk.mentions.length > 0) {
        replyMsg += `📌 Danh sách ${userAfk.mentions.length} tin nhắn tag bạn khi vắng mặt:\n`;
        userAfk.mentions.forEach((item, index) => {
          replyMsg += `\n${index + 1}. 👤 ${item.authorName}: "${item.content}"`;
        });
      } else {
        replyMsg += `✨ Không có ai tag bạn trong lúc vắng mặt.`;
      }

      delete afkData[senderID];
      saveAfkData(afkData);

      return api.sendMessage(replyMsg, threadID, messageID);
    }

    // 2. Kiểm tra xem tin nhắn có tag người đang AFK không (Quét cả Mention xanh & Text thường)
    for (const [afkUID, userAfk] of Object.entries(afkData)) {
      let isTagged = false;

      // A. Quét qua Mention chuẩn của FB
      if (mentions && Object.keys(mentions).length > 0) {
        if (mentions[afkUID]) isTagged = true;
      }

      // B. Quét qua Chữ thường (Ví dụ ai đó gõ Anh Huy hoặc @Anh Huy)
      if (!isTagged && userAfk.name) {
        if (body.toLowerCase().includes(userAfk.name.toLowerCase())) {
          isTagged = true;
        }
      }

      // Bắt được tin nhắn Tag
      if (isTagged && senderID !== afkUID) {
        let authorName = "Thành viên";
        try {
          const userInfo = await api.getUserInfo(senderID);
          if (userInfo && userInfo[senderID]) authorName = userInfo[senderID].name;
        } catch (e) {}

        userAfk.mentions.push({
          authorID: senderID,
          authorName: authorName,
          content: body
        });
        saveAfkData(afkData);

        return api.sendMessage(`⚠️ ${userAfk.name} hiện đang AFK!\n📝 Lý do: ${userAfk.reason}`, threadID, messageID);
      }
    }
  }
};