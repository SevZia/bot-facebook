module.exports.config = {
  name: "ping",
  aliases: ["tagall", "all"],
  version: "2.1.1",
  hasPermssion: 1, // 1: Chỉ QTV nhóm mới sử dụng được
  credits: "BotFB",
  description: "Réo/Tag tất cả thành viên trong nhóm kèm nội dung nhắn",
  commandCategory: "Quản lý nhóm",
  usages: "[Lý do / Nội dung cần nhắn]",
  cooldowns: 5
};

module.exports.handleEvent = async function ({ api, event }) {
  if (event.type === "message_reaction") {
    const { messageID, reaction } = event;
    const allowedReactions = ["❤", "💗", "💖", "👍", "❤️", "😍", "🥰"];

    if (allowedReactions.includes(reaction)) {
      const safeMsgID = "" + messageID;
      api.unsendMessage(safeMsgID, (err) => {
        if (err) console.error("Lỗi gỡ tin nhắn:", err);
      });
    }
  }
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const safeMsgID = "" + messageID;

  try {
    const threadInfo = await api.getThreadInfo(threadID);
    const adminIDs = threadInfo.adminIDs ? threadInfo.adminIDs.map(item => item.id) : [];

    // Kiểm tra xem người dùng có phải QTV nhóm không
    if (this.config.hasPermssion === 1 && !adminIDs.includes(senderID)) {
      return api.sendMessage("⚠️ Chỉ Quản trị viên nhóm mới có quyền réo tất cả thành viên!", threadID, safeMsgID);
    }

    const participantIDs = threadInfo.participantIDs || [];
    const content = args.join(" ") || "Mọi người vào tương tác kìa!";

    let mentions = [];
    let body = `📣 [ THÔNG BÁO TỪ QUẢN TRỊ VIÊN ]\n─────────────\n💬 Nội dung: ${content}\n─────────────\n`;

    for (let id of participantIDs) {
      body += `\u200E`;
      mentions.push({
        id: id,
        tag: "\u200E"
      });
    }

    body += `📌 Đã réo ${participantIDs.length} thành viên!`;

    return api.sendMessage({ body, mentions }, threadID, safeMsgID);

  } catch (e) {
    return api.sendMessage(`❌ Lỗi: ${e.message}`, threadID, safeMsgID);
  }
};