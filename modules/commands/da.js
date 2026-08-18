const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "đá",
  aliases: ["da"],
  version: "10.2.0",
  hasPermssion: 0,
  credits: "BotFB",
  description: "Đá một ai đó",
  commandCategory: "Giải trí",
  usages: "[@tag / Reply]",
  cooldowns: 2
};

module.exports.run = async function ({ api, event }) {
  const { threadID, messageID, senderID, mentions, type, messageReply } = event;
  let targetID = Object.keys(mentions)[0] || (type === "message_reply" ? messageReply.senderID : null);

  if (!targetID) return api.sendMessage("⚠️ Vui lòng tag hoặc reply tin nhắn của người muốn đá!", threadID, messageID);

  let senderName = "Bạn", targetName = "người đó";
  try {
    const senderInfo = await api.getUserInfo(senderID);
    const targetInfo = await api.getUserInfo(targetID);
    senderName = senderInfo[senderID]?.name || "Bạn";
    targetName = targetInfo[targetID]?.name || "người đó";
  } catch (e) {}

  // Đọc file theo tên gốc của bạn (.gif hoặc .jpg)
  const dirPath = path.join(__dirname, "cache");
  let gifPath = path.join(dirPath, "Tom And Jerry Kick GIF by Studio Voisier.gif");

  // Kiểm tra nếu đuôi file thực tế là .jpg thì vẫn đọc được
  if (!fs.existsSync(gifPath)) {
    gifPath = path.join(dirPath, "Tom And Jerry Kick GIF by Studio Voisier.jpg");
  }

  if (!fs.existsSync(gifPath)) {
    return api.sendMessage("⚠️ Không tìm thấy file GIF trong thư mục modules/commands/cache!", threadID, messageID);
  }

  const msg = {
    body: ` ${senderName} đã tung cú đá vào mông ${targetName} nè!`,
    mentions: [{ id: senderID, tag: senderName }, { id: targetID, tag: targetName }],
    attachment: fs.createReadStream(gifPath)
  };

  return api.sendMessage(msg, threadID, messageID);
};