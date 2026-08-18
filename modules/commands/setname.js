const fs = require("fs");
const path = require("path");

const adminConfigPath = path.join(__dirname, "admin_config.json");

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
  name: "setname",
  aliases: ["bd", "nickname", "checksn"],
  version: "2.0.0",
  hasPermssion: 0,
  credits: "BotFB",
  description: "Đổi biệt danh và kiểm tra thành viên chưa có biệt danh",
  commandCategory: "Quản lý nhóm",
  usages: "[bd <tên> / add <tên> / remove / list / checksn]",
  cooldowns: 3
};

const autoSetnameConfig = {};

module.exports.handleEvent = async function ({ api, event }) {
  if (event.logMessageType === "log:subscribe") {
    const { threadID, logMessageData } = event;
    const addedParticipants = logMessageData.addedParticipants || [];

    if (autoSetnameConfig[threadID]) {
      const nameTemplate = autoSetnameConfig[threadID];
      for (const user of addedParticipants) {
        try {
          await api.changeNickname(nameTemplate, threadID, user.userFbId);
        } catch (e) {
          console.error("Lỗi tự động đặt biệt danh:", e);
        }
      }
    }
  }
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, mentions, type, messageReply, senderID } = event;
  
  // KIỂM TRA QUYỀN QTV
  if (!isAllowed(threadID, senderID)) {
    return api.sendMessage("⚠️ Nhóm hiện đang bật chế độ [Chỉ QTV dùng Bot]! Bạn không có quyền sử dụng lệnh.", threadID, messageID);
  }

  const subCommand = args[0]?.toLowerCase();

  // 1. Cú pháp: /setname checksn (hoặc /setname check)
  if (subCommand === "checksn" || subCommand === "check") {
    try {
      const threadInfo = await api.getThreadInfo(threadID);
      const participantIDs = threadInfo.participantIDs || [];
      const nicknames = threadInfo.nicknames || {};

      const noNicknameIDs = participantIDs.filter(id => !nicknames[id] || nicknames[id].trim() === "");

      if (noNicknameIDs.length === 0) {
        return api.sendMessage("🎉 Tuyệt vời! Tất cả thành viên trong nhóm đều đã có biệt danh.", threadID, messageID);
      }

      const usersInfo = await api.getUserInfo(noNicknameIDs);
      let msg = `📌 [ DS THÀNH VIÊN CHƯA ĐỔI BIỆT DANH ]\n─────────────\n`;
      let count = 0;

      for (const id of noNicknameIDs) {
        count++;
        const name = usersInfo[id]?.name || "Thành viên Facebook";
        msg += `${count}. ${name}\n`;
      }

      msg += `─────────────\n👉 Tổng cộng: ${noNicknameIDs.length} thành viên chưa đặt biệt danh!`;
      return api.sendMessage(msg, threadID, messageID);
    } catch (e) {
      return api.sendMessage(`❌ Lỗi kiểm tra biệt danh: ${e.message}`, threadID, messageID);
    }
  }

  // 2. Cú pháp: /setname add <tên>
  if (subCommand === "add") {
    const autoName = args.slice(1).join(" ");
    if (!autoName) {
      return api.sendMessage("⚠️ Vui lòng nhập biệt danh cài tự động!\nVí dụ: /setname add [TVM]", threadID, messageID);
    }
    autoSetnameConfig[threadID] = autoName;
    return api.sendMessage(`✅ Đã bật tự động đặt biệt danh cho TVM: "${autoName}"`, threadID, messageID);
  }

  // 3. Cú pháp: /setname remove
  if (subCommand === "remove") {
    if (autoSetnameConfig[threadID]) {
      delete autoSetnameConfig[threadID];
      return api.sendMessage("✅ Đã tắt tự động đặt biệt danh cho TVM!", threadID, messageID);
    } else {
      return api.sendMessage("⚠️ Nhóm chưa cài đặt biệt danh tự động!", threadID, messageID);
    }
  }

  // 4. Cú pháp: /setname list
  if (subCommand === "list") {
    try {
      const threadInfo = await api.getThreadInfo(threadID);
      const nicknames = threadInfo.nicknames || {};
      let msg = "📌 [ DANH SÁCH BIỆT DANH TRONG NHÓM ]\n─────────────\n";
      let count = 0;

      for (const [userID, nick] of Object.entries(nicknames)) {
        msg += `• ${nick}\n`;
        count++;
      }

      if (count === 0) msg += "Chưa có thành viên nào đặt biệt danh!";
      return api.sendMessage(msg, threadID, messageID);
    } catch (e) {
      return api.sendMessage(`❌ Lỗi lấy danh sách: ${e.message}`, threadID, messageID);
    }
  }

  // 5. Đổi biệt danh
  let targetID = senderID;
  let nickname = "";

  if (type === "message_reply") {
    targetID = messageReply.senderID;
    nickname = args.join(" ");
  } else if (Object.keys(mentions).length > 0) {
    targetID = Object.keys(mentions)[0];
    nickname = args.join(" ").replace(mentions[targetID], "").trim();
  } else {
    if (subCommand === "bd") {
      nickname = args.slice(1).join(" ");
    } else {
      nickname = args.join(" ");
    }
  }

  try {
    const userInfo = await api.getUserInfo(targetID);
    const targetName = userInfo[targetID]?.name || "Thành viên";

    await api.changeNickname(nickname, threadID, targetID);
    
    if (targetID === senderID) {
      return api.sendMessage(`✅ Đã đổi biệt danh của bạn thành: "${nickname || "Mặc định"}"`, threadID, messageID);
    } else {
      return api.sendMessage(`✅ Đã đổi biệt danh cho [ ${targetName} ] thành: "${nickname || "Mặc định"}"`, threadID, messageID);
    }
  } catch (e) {
    return api.sendMessage(`❌ Không thể đổi biệt danh: ${e.message}`, threadID, messageID);
  }
};