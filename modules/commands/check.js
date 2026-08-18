const fs = require("fs");
const path = require("path");

const adminConfigPath = path.join(__dirname, "admin_config.json");
const dataPath = path.join(__dirname, "check_data.json");

// Hàm lưu & đọc dữ liệu bộ đếm vĩnh viễn
function getMessageCounts() {
  if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, "{}");
  try { return JSON.parse(fs.readFileSync(dataPath, "utf-8")); } catch (e) { return {}; }
}

function saveMessageCounts(data) {
  try { fs.writeFileSync(dataPath, JSON.stringify(data, null, 2)); } catch (e) {}
}

function isAllowed(threadID, senderID) {
  if (!fs.existsSync(adminConfigPath)) return true;
  try {
    const data = JSON.parse(fs.readFileSync(adminConfigPath, "utf-8"));
    const threadCfg = data[threadID];
    if (threadCfg && threadCfg.onlyAdmin) {
      return threadCfg.customAdmins && threadCfg.customAdmins.includes(senderID);
    }
    return true;
  } catch (e) {
    return true;
  }
}

module.exports.config = {
  name: "check",
  aliases: ["count", "tt"],
  version: "4.1.0",
  hasPermssion: 0,
  credits: "BotFB",
  description: "Thống kê tương tác nhóm & Reply số STT để kick thành viên (Đã lưu vĩnh viễn)",
  commandCategory: "Quản lý nhóm",
  usages: "[all / me / reset]",
  cooldowns: 2
};

// Lưu trữ các tin nhắn thống kê đã gửi
if (!global.checkReplyData) {
  global.checkReplyData = new Map();
}

// 1. Lắng nghe tin nhắn: Đếm tương tác & Lưu vào File JSON
module.exports.handleEvent = async function ({ api, event }) {
  const { threadID, senderID, messageReply, body } = event;
  if (!threadID || !senderID) return;

  // Lấy dữ liệu từ file
  const messageCounts = getMessageCounts();

  if (!messageCounts[threadID]) messageCounts[threadID] = {};
  if (!messageCounts[threadID][senderID]) messageCounts[threadID][senderID] = 0;
  
  // Cộng 1 tin nhắn và lưu lại
  messageCounts[threadID][senderID]++;
  saveMessageCounts(messageCounts);

  // TỰ ĐỘNG BẮT SỰ KIỆN REPLY NẾU DỌN NICK THEO BẢNG THỐNG KÊ
  if (messageReply && global.checkReplyData.has(messageReply.messageID) && body) {
    const data = global.checkReplyData.get(messageReply.messageID);
    
    return module.exports.handleReply({
      api,
      event,
      handleReply: data
    });
  }
};

// 2. Xử lý logic Kick khi Reply STT
module.exports.handleReply = async function ({ api, event, handleReply }) {
  const { threadID, messageID, senderID, body } = event;

  if (handleReply.author !== senderID) {
    return api.sendMessage("⚠️ Chỉ người tạo bảng thống kê mới có quyền Reply để KICK!", threadID, messageID);
  }

  const botID = api.getCurrentUserID();

  try {
    if (!isAllowed(threadID, senderID)) {
      return api.sendMessage("❌ Bạn không có quyền sử dụng tính năng này!", threadID, messageID);
    }

    const cleanBody = body.replace(/\//g, "").trim();
    const indexes = cleanBody.split(/[\s,]+/).map(item => parseInt(item)).filter(item => !isNaN(item));

    if (indexes.length === 0) return;

    const listData = handleReply.listData;
    let kickedCount = 0;
    let errorMsgs = [];

    for (const index of indexes) {
      if (index < 1 || index > listData.length) {
        errorMsgs.push(`• STT ${index}: Không có trong danh sách`);
        continue;
      }

      const target = listData[index - 1];

      if (target.id === botID) {
        errorMsgs.push(`• STT ${index} (${target.name}): Bot không thể tự kick chính mình`);
        continue;
      }

      try {
        await api.removeUserFromGroup(target.id, threadID);
        kickedCount++;
      } catch (e) {
        errorMsgs.push(`• STT ${index} (${target.name}): Lỗi kick`);
      }
    }

    let replyMsg = "";
    if (kickedCount > 0) {
      replyMsg += `✅ Đã KICK thành công ${kickedCount} thành viên khỏi nhóm!\n`;
    }
    if (errorMsgs.length > 0) {
      replyMsg += `\n⚠️ Báo lỗi:\n` + errorMsgs.join("\n");
    }

    return api.sendMessage(replyMsg.trim(), threadID, messageID);

  } catch (e) {
    return api.sendMessage(`❌ Lỗi thực thi: ${e.message}`, threadID, messageID);
  }
};

// 3. Lệnh chính /check
module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID, mentions, type, messageReply } = event;

  if (!isAllowed(threadID, senderID)) {
    return api.sendMessage("⚠️ Nhóm hiện đang bật chế độ [Chỉ QTV dùng Bot]!", threadID, messageID);
  }

  const subCommand = args[0]?.toLowerCase();
  const messageCounts = getMessageCounts();

  if (!messageCounts[threadID]) messageCounts[threadID] = {};

  // Lệnh Reset bộ đếm
  if (subCommand === "reset") {
    messageCounts[threadID] = {};
    saveMessageCounts(messageCounts);
    return api.sendMessage("✅ Đã đếm lại (reset) toàn bộ số tin nhắn tương tác của nhóm về 0!", threadID, messageID);
  }

  // Lệnh Check cá nhân (/check me hoặc tag)
  if (subCommand === "me" || type === "message_reply" || Object.keys(mentions).length > 0) {
    let targetID = senderID;
    if (type === "message_reply") targetID = messageReply.senderID;
    else if (Object.keys(mentions).length > 0) targetID = Object.keys(mentions)[0];

    const userCount = messageCounts[threadID][targetID] || 0;
    const sortedList = Object.entries(messageCounts[threadID]).sort((a, b) => b[1] - a[1]);
    const rank = sortedList.findIndex(item => item[0] === targetID) + 1;

    try {
      const userInfo = await api.getUserInfo(targetID);
      const name = userInfo[targetID]?.name || "Thành viên";
      return api.sendMessage(
        `📊 [ THỐNG KÊ TƯƠNG TÁC ]\n─────────────\n` +
        `👤 Thành viên: ${name}\n` +
        `💬 Tổng tin nhắn: ${userCount} tin\n` +
        `🏆 Xếp hạng: #${rank > 0 ? rank : "Chưa xếp hạng"}`,
        threadID,
        messageID
      );
    } catch (e) {
      return api.sendMessage(`💬 Tổng tin nhắn đã gửi: ${userCount} tin.`, threadID, messageID);
    }
  }

  // Bảng thống kê toàn bộ nhóm (/check hoặc /check all)
  try {
    const threadInfo = await api.getThreadInfo(threadID);
    const participantIDs = threadInfo.participantIDs || [];
    const usersInfo = await api.getUserInfo(participantIDs);

    let listData = participantIDs.map(id => {
      return {
        id: id,
        name: usersInfo[id]?.name || threadInfo.nicknames?.[id] || "Thành viên Facebook",
        count: messageCounts[threadID][id] || 0
      };
    });

    listData.sort((a, b) => b.count - a.count);

    let msg = `📊 [ BẢNG THỐNG KÊ TIN NHẮN NHÓM ]\n─────────────\n`;
    let totalMessages = 0;

    for (let i = 0; i < listData.length; i++) {
      const item = listData[i];
      totalMessages += item.count;
      msg += `${i + 1}. ${item.name}: ${item.count} tin nhắn\n`;
    }

    msg += `─────────────\n📌 Tổng số thành viên: ${participantIDs.length}\n💬 Tổng tương tác nhận diện: ${totalMessages} tin nhắn\n`;
    msg += `💡 Reply (trả lời) tin nhắn này kèm STT để KICK (Ví dụ: 3 hoặc 1 2 3)`;

    return api.sendMessage(msg, threadID, (err, info) => {
      if (err) return;

      const replyData = {
        name: this.config.name,
        messageID: info.messageID,
        author: senderID,
        listData: listData
      };

      global.checkReplyData.set(info.messageID, replyData);

      if (global.client && global.client.handleReply) {
        if (typeof global.client.handleReply.set === "function") {
          global.client.handleReply.set(info.messageID, replyData);
        } else if (Array.isArray(global.client.handleReply)) {
          global.client.handleReply.push(replyData);
        }
      }
    }, messageID);

  } catch (e) {
    return api.sendMessage(`❌ Lỗi thống kê: ${e.message}`, threadID, messageID);
  }
};