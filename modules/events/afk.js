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
    name: "afk_event",
    eventType: ["message", "message_reply"],
    version: "6.0.0",
    credits: "SevZia",
    description: "Bắt sự kiện tag khi AFK"
  },

  run: async function ({ api, event }) {
    const { senderID, threadID, messageID, mentions, body } = event;
    if (!threadID || !body) return;

    const afkData = getAfkData();

    // 1. Kiểm tra xem tin nhắn hiện tại có chứa tag người đang AFK không
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

        // Lưu tin nhắn vào lịch sử
        userAfk.mentions.push({
          authorID: senderID,
          authorName: authorName,
          content: body
        });
        saveAfkData(afkData);

        // Nếu người khác tag thì thông báo
        if (senderID !== afkUID) {
          api.sendMessage(`⚠️ ${userAfk.name} hiện đang AFK!\n📝 Lý do: ${userAfk.reason}`, threadID, messageID);
        }
      }
    }

    // 2. Nếu người AFK gửi 1 tin nhắn BÌNH THƯỜNG (không phải tự tag tên mình) -> Tắt AFK & Xuất danh sách
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