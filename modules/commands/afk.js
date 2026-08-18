const fs = require("fs-extra");
const path = "./modules/commands/afk.json";

function getAfkData() {
  if (!fs.existsSync(path)) fs.outputJsonSync(path, {});
  try {
    return fs.readJsonSync(path);
  } catch (e) {
    return {};
  }
}

function saveAfkData(data) {
  fs.writeJsonSync(path, data, { spaces: 2 });
}

module.exports.config = {
  name: "afk",
  aliases: ["off"],
  version: "1.0.1",
  hasPermssion: 0,
  credits: "BotFB",
  description: "Bật chế độ vắng mặt (AFK)",
  commandCategory: "Tiện ích",
  usages: "[Lý do]",
  cooldowns: 2
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, senderID, messageID } = event;
  const safeMsgID = "" + messageID;
  const reason = args.join(" ") || "Không có lý do";

  const afkData = getAfkData();
  afkData[senderID] = {
    reason: reason,
    time: Date.now()
  };

  saveAfkData(afkData);
  return api.sendMessage(`✅ Bạn đã bật chế độ AFK với lý do: "${reason}"`, threadID, safeMsgID);
};

module.exports.handleEvent = async function ({ api, event }) {
  const { threadID, senderID, messageID, mentions } = event;
  const safeMsgID = "" + messageID;
  const afkData = getAfkData();

  // 1. Nếu người đang AFK nhắn tin -> Tắt AFK
  if (afkData[senderID]) {
    const afkInfo = afkData[senderID];
    delete afkData[senderID];
    saveAfkData(afkData);

    const timeDiff = Math.floor((Date.now() - afkInfo.time) / 1000);
    const minutes = Math.floor(timeDiff / 60);
    const seconds = timeDiff % 60;
    const timeStr = minutes > 0 ? `${minutes} phút ${seconds} giây` : `${seconds} giây`;

    return api.sendMessage(`👋 Chào mừng bạn quay trở lại! Bạn đã tắt chế độ AFK (Đã vắng mặt: ${timeStr}).`, threadID, safeMsgID);
  }

  // 2. Nếu có người tag người đang AFK -> Thông báo cho người tag
  if (mentions && Object.keys(mentions).length > 0) {
    const mentionedIDs = Object.keys(mentions);
    for (const id of mentionedIDs) {
      if (afkData[id]) {
        const { reason, time } = afkData[id];
        const timeDiff = Math.floor((Date.now() - time) / 1000);
        const minutes = Math.floor(timeDiff / 60);
        const seconds = timeDiff % 60;
        const timeStr = minutes > 0 ? `${minutes} phút ${seconds} giây` : `${seconds} giây`;

        const name = mentions[id].replace("@", "").trim();
        return api.sendMessage(`📌 Người dùng [ ${name} ] hiện đang AFK!\n📝 Lý do: ${reason}\n⏱️ Vắng mặt cách đây: ${timeStr}`, threadID, safeMsgID);
      }
    }
  }
};