module.exports.config = {
  name: "ping",
  aliases: ["tagall", "all"],
  version: "2.1.0",
  hasPermssion: 1, // 0: Tất cả mọi người, 1: Chỉ QTV nhóm mới dùng được
  credits: "BotFB",
  description: "Réo/Tag tất cả thành viên trong nhóm kèm nội dung nhắn",
  commandCategory: "Quản lý nhóm",
  usages: "[Lý do / Nội dung cần nhắn]",
  cooldowns: 5
};

// TỰ ĐỘNG XÓA TIN NHẮN KHI THẢ TIM (CHẠY ẨN)
module.exports.handleEvent = async function ({ api, event }) {
  if (event.type === "message_reaction") {
    const { messageID, reaction } = event;
    const allowedReactions = ["❤", "💗", "💖", "👍", "❤️", "😍", "🥰"];

    if (allowedReactions.includes(reaction)) {
      api.unsendMessage(messageID, (err) => {
        if (err) console.error("Lỗi gỡ tin nhắn:", err);
      });
    }
  }
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;

  try {
    const threadInfo = await api.getThreadInfo(threadID);
    const participantIDs = threadInfo.participantIDs;

    // Nội dung đi kèm khi tag
    const content = args.join(" ") || "Mọi người vào tương tác kìa!";

    let mentions = [];
    let body = `📣 [ THÔNG BÁO TỪ QUẢN TRỊ VIÊN ]\n─────────────\n💬 Nội dung: ${content}\n─────────────\n`;

    // Lặp qua tất cả ID thành viên để tạo ẩn tag
    for (let id of participantIDs) {
      body += `\u200E`; // Ký tự ẩn để tag không làm rác tin nhắn
      mentions.push({
        id: id,
        tag: "\u200E"
      });
    }

    body += `📌 Đã réo ${participantIDs.length} thành viên!`;

    return api.sendMessage({ body, mentions }, threadID, messageID);

  } catch (e) {
    return api.sendMessage(`❌ Lỗi: ${e.message}`, threadID, messageID);
  }
};