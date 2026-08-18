module.exports.config = {
  name: "kick",
  aliases: ["out", "remove"],
  version: "1.0.7",
  hasPermssion: 0,
  credits: "BotFB",
  description: "Xóa thành viên khỏi nhóm qua Tag, Reply hoặc Tên",
  commandCategory: "Quản lý nhóm",
  usages: "[tag / reply / tên]",
  cooldowns: 2
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, mentions, type, messageReply } = event;
  const safeMsgID = String(messageID);
  let targetIDs = [];

  // 1. Nếu Reply tin nhắn
  if (type === "message_reply" && messageReply) {
    targetIDs.push(String(messageReply.senderID));
  } 
  // 2. Nếu có Tag chuẩn (Mentions)
  else if (mentions && Object.keys(mentions).length > 0) {
    targetIDs = Object.keys(mentions).map(id => String(id));
  } 
  // 3. Nếu gõ tên trực tiếp (Tự tìm ID theo tên)
  else if (args.length > 0) {
    const inputName = args.join(" ").replace(/@/g, "").toLowerCase().trim();
    try {
      const threadInfo = await api.getThreadInfo(threadID);
      const userInfoList = threadInfo.userInfo || [];
      const nicknames = threadInfo.nicknames || {};

      for (const u of userInfoList) {
        const name = (u.name || "").toLowerCase();
        const nickname = (nicknames[u.id] || "").toLowerCase();
        
        if (name.includes(inputName) || nickname.includes(inputName)) {
          targetIDs.push(String(u.id));
        }
      }
    } catch (e) {
      console.error("Lỗi lấy danh sách thành viên:", e);
    }
  }

  if (targetIDs.length === 0) {
    return api.sendMessage("⚠️ Vui lòng Reply tin nhắn, @tag người dùng hoặc nhập đúng tên thành viên!", threadID, safeMsgID);
  }

  const botID = String(api.getCurrentUserID());
  const removeFn = api.removeUserFromGroup || api.removeUserFromThread || api.removeUser;

  if (typeof removeFn !== "function") {
    return api.sendMessage("❌ Thư viện FCA chưa hỗ trợ hàm kick!", threadID, safeMsgID);
  }

  try {
    const threadInfo = await api.getThreadInfo(threadID);
    const adminIDs = threadInfo.adminIDs ? threadInfo.adminIDs.map(item => String(item.id)) : [];

    if (!adminIDs.includes(botID)) {
      return api.sendMessage("❌ Bot chưa có quyền Quản trị viên nhóm!", threadID, safeMsgID);
    }

    let successCount = 0;
    let failCount = 0;

    for (const id of targetIDs) {
      if (id === botID) continue;

      await new Promise((resolve) => {
        removeFn.call(api, id, String(threadID), (err) => {
          if (err) {
            console.error(`[LỖI KICK] UID ${id}:`, err);
            failCount++;
          } else {
            successCount++;
          }
          resolve();
        });
      });
    }

    if (successCount > 0) {
      return api.sendMessage(`✅ Đã kích thành công ${successCount} thành viên ra khỏi nhóm!`, threadID, safeMsgID);
    } else if (failCount > 0) {
      return api.sendMessage("❌ Không thể kick (Do Facebook chặn hoặc người này là QTV).", threadID, safeMsgID);
    }

  } catch (e) {
    return api.sendMessage(`❌ Lỗi thực thi: ${e.message}`, threadID, safeMsgID);
  }
};