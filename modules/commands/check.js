const fs = require("fs");
const path = require("path");

const adminConfigPath = path.join(__dirname, "admin_config.json");
const dataPath = path.join(__dirname, "check_data.json");

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

function kickUser(api, userID, threadID) {
  return new Promise((resolve, reject) => {
    api.removeUserFromGroup(String(userID), String(threadID), (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

module.exports.config = {
  name: "check",
  aliases: ["count", "tt"],
  version: "4.3.7",
  hasPermssion: 0,
  credits: "BotFB",
  description: "Thống kê tương tác nhóm & Reply số STT để kick thành viên",
  commandCategory: "Quản lý nhóm",
  usages: "[all / me / reset]",
  cooldowns: 2
};

if (!global.checkReplyData) {
  global.checkReplyData = new Map();
}

module.exports.handleEvent = async function ({ api, event }) {
  const { threadID, senderID, messageReply, body } = event;
  if (!threadID || !senderID) return;

  const messageCounts = getMessageCounts();
  if (!messageCounts[threadID]) messageCounts[threadID] = {};
  if (!messageCounts[threadID][senderID]) messageCounts[threadID][senderID] = 0;
  
  messageCounts[threadID][senderID]++;
  saveMessageCounts(messageCounts);

  if (messageReply && body) {
    const replyID = String(messageReply.messageID);
    if (global.checkReplyData.has(replyID)) {
      const data = global.checkReplyData.get(replyID);
      global.checkReplyData.delete(replyID);
      return module.exports.handleReply({ api, event, handleReply: data });
    }
  }
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
  const { threadID, messageID, senderID, body } = event;
  const safeMsgID = String(messageID);

  if (handleReply.author !== senderID) {
    return api.sendMessage("⚠️ Chỉ người tạo bảng thống kê mới có quyền Reply để KICK!", threadID, safeMsgID);
  }

  const botID = String(api.getCurrentUserID());

  try {
    if (!isAllowed(threadID, senderID)) {
      return api.sendMessage("❌ Bạn không có quyền sử dụng tính năng này!", threadID, safeMsgID);
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
      const targetID = String(target.id);

      if (targetID === botID) {
        errorMsgs.push(`• STT ${index} (${target.name}): Bot không thể tự kick chính mình`);
        continue;
      }

      try {
        await kickUser(api, targetID, threadID);
        kickedCount++;
      } catch (e) {
        errorMsgs.push(`• STT ${index} (${target.name}): Lỗi FB chặn hoặc thiếu quyền QTV`);
      }
    }

    let replyMsg = "";
    if (kickedCount > 0) replyMsg += `✅ Đã KICK thành công ${kickedCount} thành viên khỏi nhóm!\n`;
    if (errorMsgs.length > 0) replyMsg += `\n⚠️ Báo lỗi:\n` + errorMsgs.join("\n");

    return api.sendMessage(replyMsg.trim(), threadID, safeMsgID);

  } catch (e) {
    return api.sendMessage(`❌ Lỗi thực thi: ${e.message}`, threadID, safeMsgID);
  }
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID, mentions, type, messageReply } = event;
  const safeMsgID = String(messageID);

  if (!isAllowed(threadID, senderID)) {
    return api.sendMessage("⚠️ Nhóm hiện đang bật chế độ [Chỉ QTV dùng Bot]!", threadID, safeMsgID);
  }

  const subCommand = args[0]?.toLowerCase();
  const messageCounts = getMessageCounts();
  if (!messageCounts[threadID]) messageCounts[threadID] = {};

  if (subCommand === "reset") {
    messageCounts[threadID] = {};
    saveMessageCounts(messageCounts);
    return api.sendMessage("✅ Đã reset toàn bộ số tin nhắn tương tác của nhóm về 0!", threadID, safeMsgID);
  }

  if (subCommand === "me" || type === "message_reply" || (mentions && Object.keys(mentions).length > 0)) {
    let targetID = senderID;
    if (type === "message_reply") targetID = messageReply.senderID;
    else if (mentions && Object.keys(mentions).length > 0) targetID = Object.keys(mentions)[0];

    const userCount = messageCounts[threadID][targetID] || 0;
    const sortedList = Object.entries(messageCounts[threadID]).sort((a, b) => b[1] - a[1]);
    const rank = sortedList.findIndex(item => item[0] === targetID) + 1;

    let name = "Thành viên";
    try {
      const threadInfo = await api.getThreadInfo(threadID);
      if (threadInfo.userInfo) {
        const u = threadInfo.userInfo.find(x => x.id === targetID);
        if (u && u.name) name = u.name;
      }
    } catch (e) {}

    return api.sendMessage(
      `📊 [ THỐNG KÊ TƯƠNG TÁC ]\n─────────────\n` +
      `👤 Thành viên: ${name}\n` +
      `💬 Tổng tin nhắn: ${userCount} tin\n` +
      `🏆 Xếp hạng: #${rank > 0 ? rank : "Chưa xếp hạng"}`,
      threadID,
      safeMsgID
    );
  }

  try {
    const threadInfo = await api.getThreadInfo(threadID);
    const userInfoList = threadInfo.userInfo || [];
    const nicknames = threadInfo.nicknames || {};

    let listData = userInfoList.map(u => {
      return {
        id: u.id,
        name: nicknames[u.id] || u.name || "Thành viên Facebook",
        count: messageCounts[threadID][u.id] || 0
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

    msg += `─────────────\n📌 Tổng số thành viên: ${listData.length}\n💬 Tổng tương tác nhận diện: ${totalMessages} tin nhắn\n`;
    msg += `💡 Reply (trả lời) tin nhắn này kèm STT để KICK (Ví dụ: 3 hoặc 1 2 3)`;

    const info = await api.sendMessage(msg, threadID, safeMsgID);
    if (info && info.messageID) {
      const outMsgID = String(info.messageID);
      global.checkReplyData.set(outMsgID, {
        name: this.config.name,
        messageID: outMsgID,
        author: senderID,
        listData: listData
      });
    }

  } catch (e) {
    return api.sendMessage(`❌ Lỗi thống kê: ${e.message}`, threadID, safeMsgID);
  }
};