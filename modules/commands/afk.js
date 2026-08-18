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
    version: "5.0.0",
    hasPermssion: 0,
    credits: "SevZia",
    description: "Tự động ghi nhận tin nhắn khi bị tag lúc AFK (Hỗ trợ test bằng chính chủ)",
    commandCategory: "Tiện ích",
    usages: "[lý do]",
    cooldowns: 2
  },

  run: async function ({ api, event, args }) {
    const { senderID, threadID, messageID } = event;
    const reason = args.join(" ") || "Không có lý do";
    const afkData = getAfkData();

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

    // 1. Kiểm tra xem tin nhắn có chứa chữ Tag/Mention của ai đang AFK không
    let isTagMsg = false;
    for (const [afkUID, userAfk] of Object.entries(afkData)) {
      let isTagged = false;

      // Quét qua Mention xanh
      if (mentions && Object.keys(mentions).length > 0 && mentions[afkUID]) {
        isTagged = true;
      }

      // Quét qua chữ thường (ví dụ: @Anh Huy, Anh Huy)
      if (!isTagged && userAfk.name && body.toLowerCase().includes(userAfk.name.toLowerCase())) {
        isTagged = true;
      }

      if (isTagged) {
        isTagMsg = true;

        let authorName = "Chính bạn";
        if (senderID !== afkUID) {
          try {
            const userInfo = await api.getUserInfo(senderID);
            if (userInfo && userInfo[senderID]) authorName = userInfo[senderID].name;
          } catch (e) {
            authorName = "Thành viên";
          }
        }

        // Lưu vết tin nhắn tag
        userAfk.mentions.push({
          authorID: senderID,
          authorName: authorName,
          content: body
        });
        saveAfkData(afkData);

        // Báo AFK (chỉ báo khi người khác tag, chính chủ tự tag thì âm thầm lưu)
        if (senderID !== afkUID) {
          api.sendMessage(`⚠️ ${userAfk.name} hiện đang AFK!\n📝 Lý do: ${userAfk.reason}`, threadID, messageID);
        }
      }
    }

    // 2. Nếu chính người AFK nhắn một tin nhắn BÌNH THƯỜNG (không chứa chữ tag tên mình) -> TẮT AFK & BÁO CÁO
    if (afkData[senderID] && !isTagMsg) {
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
  }
};