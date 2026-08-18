const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "ôm",
  aliases: ["om", "hug"],
  version: "1.1.1",
  hasPermssion: 0,
  credits: "BotFB",
  description: "Ôm một ai đó",
  commandCategory: "Giải trí",
  usages: "[@tag / Reply]",
  cooldowns: 2
};

module.exports.run = async function ({ api, event }) {
  const { threadID, messageID, senderID, mentions, type, messageReply } = event;
  const safeMsgID = "" + messageID;

  let targetID = type === "message_reply" && messageReply ? messageReply.senderID : (mentions && Object.keys(mentions)[0]);

  if (!targetID) {
    return api.sendMessage("⚠️ Nhắm ai thì tag/reply vô, ôm cột điện hay gì?", threadID, safeMsgID);
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
  let gifPath = path.join(dirPath, "Dogs Embracing GIF.gif");
  if (!fs.existsSync(gifPath)) gifPath = path.join(dirPath, "Dogs Embracing GIF.jpg");
  if (!fs.existsSync(gifPath)) gifPath = path.join(dirPath, "Dogs Embracing GIF.png");

  const msg = {
    body: `🤗 ${senderName} lao vào ôm siết lấy ${targetName} suýt gãy 3 cái xương sườn! 🦴`,
    mentions: [{ id: senderID, tag: senderName }, { id: targetID, tag: targetName }]
  };
  if (fs.existsSync(gifPath)) msg.attachment = fs.createReadStream(gifPath);

  return api.sendMessage(msg, threadID, safeMsgID);
};