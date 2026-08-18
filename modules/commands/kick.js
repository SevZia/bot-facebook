module.exports.config = {
  name: "kick",
  aliases: ["out", "remove"],
  version: "1.0.2",
  hasPermssion: 0,
  credits: "BotFB",
  description: "Xóa thành viên khỏi nhóm",
  commandCategory: "Quản lý nhóm",
  usages: "[tag / reply]",
  cooldowns: 2
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, mentions, type, messageReply, senderID } = event;
  let targetIDs = [];

  if (type === "message_reply") {
    targetIDs.push(messageReply.senderID);
  } else if (Object.keys(mentions).length > 0) {
    targetIDs = Object.keys(mentions);
  } else {
    return api.sendMessage("⚠️ Vui lòng **Reply tin nhắn** hoặc **@tag** người cần kick!", threadID, messageID);
  }

  const botID = api.getCurrentUserID();

  try {
    const threadInfo = await api.getThreadInfo(threadID);
    const adminIDs = threadInfo.adminIDs.map(item => item.id);

    if (!adminIDs.includes(botID)) {
      return api.sendMessage("❌ Bot chưa có quyền Quản trị viên nhóm!", threadID, messageID);
    }

    for (const id of targetIDs) {
      if (id === botID) continue;
      
      // Thực hiện xóa và bắt lỗi chi tiết từ Facebook
      api.removeUserFromGroup(id, threadID, (err) => {
        if (err) {
          console.error("Lỗi xóa thành viên:", err);
          return api.sendMessage(`❌ Facebook chặn tính năng kích người của Nick Clone:\n👉 Chi tiết: ${err.errorSummary || err.summary || err.message || "Tài khoản bị hạn chế thao tác xóa thành viên."}`, threadID, messageID);
        } else {
          return api.sendMessage("✅ Đã kích thành công thành viên ra khỏi nhóm!", threadID, messageID);
        }
      });
    }
  } catch (e) {
    return api.sendMessage(`❌ Lỗi thực thi: ${e.message}`, threadID, messageID);
  }
};