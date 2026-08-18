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
    version: "2.0.0",
    hasPermssion: 0,
    credits: "SevZia",
    description: "Bật chế độ AFK và thông báo tin nhắn khi có người tag",
    commandCategory: "Tiện ích",
    usages: "[lý do]",
    cooldowns: 5
  },

  // 1. Kích hoạt chế độ AFK khi gõ /afk
  run: async function ({ api, event, args }) {
    const { senderID, threadID, messageID } = event;
    const reason = args.join(" ") || "Không có lý do";
    const afkData = getAfkData();

    afkData[senderID] = {
      time: Date.now(),
      reason: reason,
      mentions: [] // Mảng lưu thông tin các tin nhắn tag
    };

    saveAfkData(afkData);
    return api.sendMessage(`🔑 Bạn đã bật chế độ AFK.\n📝 Lý do: ${reason}`, threadID, messageID);
  },

  // 2. Tự động kiểm tra sự kiện tin nhắn trong box
  handleEvent: async function ({ api, event }) {
    const { senderID, threadID, messageID, mentions, body } = event;
    const afkData = getAfkData();

    // A. Nếu người dùng đang AFK mà nhắn tin -> TẮT AFK & BÁO CÁO TIN NHẮN ĐƯỢC TAG
    if (afkData[senderID]) {
      const userAfk = afkData[senderID];
      const timeAfk = Math.floor((Date.now() - userAfk.time) / 1000);
      const minutes = Math.floor(timeAfk / 60);
      const seconds = timeAfk % 60;
      const timeStr = minutes > 0 ? `${minutes} phút ${seconds} giây` : `${seconds} giây`;

      let replyMsg = `👋 Chào mừng bạn quay lại!\n⏱️ Thời gian AFK: ${timeStr}\n📝 Lý do: ${userAfk.reason}\n\n`;

      if (userAfk.mentions && userAfk.mentions.length > 0) {
        replyMsg += `✨ Danh sách ${userAfk.mentions.length} tin nhắn tag bạn trong lúc vắng mặt:\n`;
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

    // B. Nếu có người tag người đang AFK -> BÁO CHO NGUỜI TAG & LƯU LẠI NỘI DUNG
    if (mentions && Object.keys(mentions).length > 0) {
      for (const [taggedUID, taggedName] of Object.entries(mentions)) {
        if (afkData[taggedUID]) {
          const userAfk = afkData[taggedUID];

          // Lấy tên người tag
          let authorName = "Ai đó";
          try {
            const userInfo = await api.getUserInfo(senderID);
            authorName = userInfo[senderID]?.name || "Người dùng";
          } catch (e) {}

          // Lưu tin nhắn tag vào danh sách
          userAfk.mentions.push({
            authorID: senderID,
            authorName: authorName,
            content: body || "Đã tag bạn"
          });
          saveAfkData(afkData);

          // Báo cho người tag biết
          api.sendMessage(`⚠️ Người dùng ${taggedName.replace("@", "")} hiện đang AFK!\n📝 Lý do: ${userAfk.reason}`, threadID, messageID);
        }
      }
    }
  }
};