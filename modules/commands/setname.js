module.exports.config = {
  name: "setname",
  aliases: ["bietdanh", "sn"],
  version: "1.0.6",
  hasPermssion: 0,
  credits: "BotFB",
  description: "Đổi biệt danh cá nhân hoặc kiểm tra danh sách biệt danh nhóm",
  commandCategory: "Quản lý",
  usages: "[tên cần đổi / check / list]",
  cooldowns: 2
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID, mentions, type, messageReply } = event;
  const safeMsgID = typeof messageID === "string" ? messageID : String(messageID).valueOf();

  if (!args[0]) {
    return api.sendMessage("⚠️ Vui lòng nhập tên cần đổi hoặc nhập 'check' / 'list'!", threadID, safeMsgID);
  }

  const subCommand = args[0].toLowerCase();

  try {
    const threadInfo = await api.getThreadInfo(threadID);
    const nicknames = threadInfo.nickname || {};
    const userInfo = threadInfo.userInfo || [];

    // 1. Lệnh xem ai chưa đổi biệt danh (Đã bỏ ẩn ID)
    if (subCommand === "check" || subCommand === "checksn") {
      let noNicknameList = [];

      for (const user of userInfo) {
        if (!nicknames[user.id]) {
          noNicknameList.push(user.name || "Thành viên Facebook");
        }
      }

      if (noNicknameList.length === 0) {
        return api.sendMessage("🎉 Tất cả thành viên trong nhóm đều đã có biệt danh!", threadID, safeMsgID);
      }

      let msg = `📌 [ DS THÀNH VIÊN CHƯA ĐỔI BIỆT DANH ]\n─────────────\n`;
      noNicknameList.forEach((name, index) => {
        msg += `${index + 1}. ${name}\n`;
      });
      msg += `─────────────\n👉 Tổng cộng: ${noNicknameList.length} thành viên chưa đặt biệt danh!`;

      return api.sendMessage(msg, threadID, safeMsgID);
    }

    // 2. Lệnh xem toàn bộ danh sách biệt danh nhóm
    if (subCommand === "list") {
      let msg = `📋 [ DANH SÁCH BIỆT DANH NHÓM ]\n─────────────\n`;
      let count = 0;

      for (const user of userInfo) {
        const nickname = nicknames[user.id];
        if (nickname) {
          count++;
          msg += `${count}. ${user.name} ➔ ${nickname}\n`;
        }
      }

      if (count === 0) {
        return api.sendMessage("⚠️ Chưa có thành viên nào trong nhóm đặt biệt danh!", threadID, safeMsgID);
      }

      msg += `─────────────\n👉 Tổng cộng: ${count} thành viên đã có biệt danh!`;
      return api.sendMessage(msg, threadID, safeMsgID);
    }

    // 3. Thực hiện đổi biệt danh
    let targetID = senderID;
    let newName = args.join(" ");

    if (type === "message_reply" && messageReply) {
      targetID = messageReply.senderID;
    } else if (mentions && Object.keys(mentions).length > 0) {
      targetID = Object.keys(mentions)[0];
      const mentionName = mentions[targetID];
      newName = newName.replace(mentionName, "").trim();
    }

    api.changeNickname(newName, threadID, targetID, (err) => {
      if (err) return api.sendMessage("❌ Không thể đổi biệt danh! Kiểm tra lại quyền của Bot.", threadID, safeMsgID);
      return api.sendMessage(`✅ Đã đổi biệt danh thành công: "${newName}"`, threadID, safeMsgID);
    });

  } catch (error) {
    console.error("Lỗi setname:", error);
    return api.sendMessage("❌ Đã xảy ra lỗi khi thực hiện lệnh!", threadID, safeMsgID);
  }
};