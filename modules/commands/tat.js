const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "tát",
  aliases: ["tat", "slap"],
  version: "1.1.1",
  hasPermssion: 0,
  credits: "BotFB",
  description: "Tát một ai đó",
  commandCategory: "Giải trí",
  usages: "[@tag / Reply]",
  cooldowns: 2
};

module.exports.run = async function ({ api, event }) {
  const { threadID, messageID, senderID, mentions, type, messageReply } = event;
  const safeMsgID = "" + messageID;

  let targetID = type === "message_reply" && messageReply ? messageReply.senderID : (mentions && Object.keys(mentions)[0]);

  if (!targetID) {
    return api.sendMessage("⚠️ Vui lòng tag hoặc reply đứa bạn muốn vả cho tỉnh ngủ!", threadID, safeMsgID);
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
  let gifPath = path.join(dirPath, "Comedy Rage GIF by Wakuma.gif");
  if (!fs.existsSync(gifPath)) gifPath = path.join(dirPath, "Comedy Rage GIF by Wakuma.jpg");
  if (!fs.existsSync(gifPath)) gifPath = path.join(dirPath, "Comedy Rage GIF by Wakuma.png");

  const msg = {
    body: `👋 ${senderName} đã vung tay tát lệch hàm ${targetName} vì cái tội phát ngôn khó nghe! 💥`,
    mentions: [{ id: senderID, tag: senderName }, { id: targetID, tag: targetName }]
  };
  if (fs.existsSync(gifPath)) msg.attachment = fs.createReadStream(gifPath);

  return api.sendMessage(msg, threadID, safeMsgID);
};