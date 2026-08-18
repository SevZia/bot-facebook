const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "hôn",
  aliases: ["hon", "kiss"],
  version: "1.0.0",
  hasPermssion: 0,
  credits: "BotFB",
  description: "Hôn một ai đó",
  commandCategory: "Giải trí",
  usages: "[@tag / Reply]",
  cooldowns: 2
};

module.exports.run = async function ({ api, event }) {
  const { threadID, messageID, senderID, mentions, type, messageReply } = event;
  let targetID = Object.keys(mentions)[0] || (type === "message_reply" ? messageReply.senderID : null);

  if (!targetID) return api.sendMessage("⚠️ Vui lòng tag hoặc reply tin nhắn của người muốn hôn!", threadID, messageID);

  let senderName = "Bạn", targetName = "người đó";
  try {
    const senderInfo = await api.getUserInfo(senderID);
    const targetInfo = await api.getUserInfo(targetID);
    senderName = senderInfo[senderID]?.name || "Bạn";
    targetName = targetInfo[targetID]?.name || "người đó";
  } catch (e) {}

  const dirPath = path.join(__dirname, "cache");
  let gifPath = path.join(dirPath, "kitty kiss GIF.gif");

  // Tự động kiểm tra nếu file có đuôi .jpg hoặc .gif
  if (!fs.existsSync(gifPath)) {
    gifPath = path.join(dirPath, "kitty kiss GIF.jpg");
  }

  if (!fs.existsSync(gifPath)) {
    return api.sendMessage("⚠️ Không tìm thấy file GIF 'kitty kiss GIF' trong thư mục cache!", threadID, messageID);
  }

  const msg = {
    body: `💋 ${senderName} đã trao cho ${targetName} một nụ hôn cực kỳ ngọt ngào! 😘`,
    mentions: [{ id: senderID, tag: senderName }, { id: targetID, tag: targetName }],
    attachment: fs.createReadStream(gifPath)
  };

  return api.sendMessage(msg, threadID, messageID);
};