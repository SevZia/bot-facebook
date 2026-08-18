const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "đá",
  aliases: ["da", "kickk"],
  version: "1.2.2",
  hasPermssion: 0,
  credits: "BotFB",
  description: "Đá một ai đó",
  commandCategory: "Giải trí",
  usages: "[@tag / Reply]",
  cooldowns: 2
};

module.exports.run = async function ({ api, event }) {
  const { threadID, messageID, senderID, mentions, type, messageReply } = event;
  const safeMsgID = "" + messageID;

  let targetID = type === "message_reply" && messageReply ? messageReply.senderID : (mentions && Object.keys(mentions)[0]);

  if (!targetID) {
    return api.sendMessage("⚠️ Tag hoặc reply cái đứa bạn muốn tung cước lộn 3 vòng đi!", threadID, safeMsgID);
  }

  let senderName = "Bạn", targetName = "người đó";
  try {
    const threadInfo = await api.getThreadInfo(threadID);
    const senderUser = threadInfo.userInfo?.find(u => String(u.id) === String(senderID));
    const targetUser = threadInfo.userInfo?.find(u => String(u.id) === String(targetID));
    if (senderUser && senderUser.name) senderName = senderUser.name;
    if (targetUser && targetUser.name) targetName = targetUser.name;
  } catch (e) {}

  const dirPath = path.join(__dirname, "cache");
  let gifPath = path.join(dirPath, "Tom And Jerry Kick GIF by Studio Voisier.gif");
  if (!fs.existsSync(gifPath)) gifPath = path.join(dirPath, "Tom And Jerry Kick GIF by Studio Voisier.jpg");
  if (!fs.existsSync(gifPath)) gifPath = path.join(dirPath, "Tom And Jerry Kick GIF by Studio Voisier.png");

  const msg = {
    body: `🦵 ${senderName} đã tung cú đá hoàng gia tiễn ${targetName} văng thẳng lên đọt dừa! 🚀`,
    mentions: [{ id: senderID, tag: senderName }, { id: targetID, tag: targetName }]
  };

  if (fs.existsSync(gifPath)) {
    msg.attachment = fs.createReadStream(gifPath);
  }

  return api.sendMessage(msg, threadID, safeMsgID);
};