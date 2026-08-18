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
    version: "3.0.0",
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

    afkData[senderID] = {
      time: Date.now(),
      reason: reason,
      mentions: []
    };

    saveAfkData(afkData);
    return api.sendMessage(`✅ Đã bật chế độ AFK!\n📝 Lý do: ${reason}`, threadID, messageID);
  },

  handleEvent: async function ({ api, event }) {
    const { senderID, threadID, messageID, mentions, body } = event;
    if (!threadID) return;

    const afkData = getAfkData();

    // 1. Khi người AFK nhắn tin trở lại
    if (afkData[senderID]) {
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

    // 2. Khi có người tag ai đó đang AFK
    if (mentions && Object.keys(mentions).length > 0) {
      for (const [taggedUID, taggedName] of Object.entries(mentions)) {
        if (afkData[taggedUID] && taggedUID !== senderID) {
          const userAfk = afkData[taggedUID];

          let authorName = "Thành viên";
          try {
            const userInfo = await api.getUserInfo(senderID);
            if (userInfo && userInfo[senderID]) {
              authorName = userInfo[senderID].name;
            }
          } catch (e) {}

          const cleanName = taggedName.replace("@", "");
          const contentText = body ? body.replace(taggedName, "").trim() : "Đã tag bạn";

          userAfk.mentions.push({
            authorID: senderID,
            authorName: authorName,
            content: contentText || "Đã tag bạn"
          });
          saveAfkData(afkData);

          return api.sendMessage(`⚠️ ${cleanName} hiện đang AFK!\n📝 Lý do: ${userAfk.reason}`, threadID, messageID);
        }
      }
    }
  }
};