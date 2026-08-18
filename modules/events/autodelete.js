module.exports.config = {
  name: "autodelete",
  eventType: ["message_reaction"],
  version: "1.0.0",
  credits: "BotFB",
  description: "Tự động gỡ/xóa tin nhắn của Bot khi có người thả tim hoặc cảm xúc"
};

module.exports.run = async function ({ api, event }) {
  const { messageID, reaction } = event;

  // Danh sách các cảm xúc kích hoạt xóa tin nhắn
  const allowedReactions = ["❤", "💗", "💖", "👍", "❤️"];

  try {
    if (allowedReactions.includes(reaction)) {
      api.unsendMessage(messageID, (err) => {
        if (err) console.error("Lỗi gỡ tin nhắn:", err);
      });
    }
  } catch (e) {
    console.error("Lỗi event autodelete:", e);
  }
};