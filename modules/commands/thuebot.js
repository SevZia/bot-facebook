const fs = require("fs-extra");
const path = "./modules/commands/thuebot.json";

module.exports = {
  config: {
    name: "thuebot",
    aliases: ["thue"],
    version: "1.0.1",
    hasPermssion: 2, // Chỉ Admin Bot mới dùng được
    credits: "BotFB",
    description: "Quản lý và kích hoạt hạn thuê bot cho nhóm",
    commandCategory: "Admin",
    usages: "[add <ngày> / check / list]",
    cooldowns: 2
  },

  run: async function ({ api, event, args, config }) {
    const { threadID, senderID, messageID } = event;
    const safeMsgID = "" + messageID;

    // Kiểm tra quyền Admin Bot
    const adminBotList = config.ADMINBOT || [];
    if (!adminBotList.includes(senderID)) {
      return api.sendMessage("⚠️ Chỉ Admin Bot mới có quyền dùng lệnh này!", threadID, safeMsgID);
    }

    if (!fs.existsSync(path)) fs.outputJsonSync(path, {});
    let data = fs.readJsonSync(path);

    const subCommand = args[0]?.toLowerCase();

    // 1. Kích hoạt/Gia hạn thuê bot: /thuebot add <số_ngày> [threadID]
    if (subCommand === "add") {
      const days = parseInt(args[1]) || 30;
      const targetThreadID = args[2] || threadID;

      const currentExpire = data[targetThreadID]?.expire && data[targetThreadID].expire > Date.now() 
        ? data[targetThreadID].expire 
        : Date.now();

      const newExpire = currentExpire + days * 24 * 60 * 60 * 1000;
      data[targetThreadID] = { expire: newExpire };
      fs.writeJsonSync(path, data, { spaces: 2 });

      const expireDate = new Date(newExpire).toLocaleDateString("vi-VN");
      return api.sendMessage(`✅ Đã kích hoạt/gia hạn thuê bot cho nhóm [${targetThreadID}]\n⏱️ Hạn dùng đến ngày: ${expireDate} (${days} ngày)`, threadID, safeMsgID);
    }

    // 2. Kiểm tra hạn thuê: /thuebot check
    if (subCommand === "check") {
      if (!data[threadID] || !data[threadID].expire) {
        return api.sendMessage("⚠️ Nhóm này chưa được kích hoạt thuê bot!", threadID, safeMsgID);
      }

      const timeLeft = data[threadID].expire - Date.now();
      if (timeLeft <= 0) {
        return api.sendMessage("❌ Nhóm này đã HẾT HẠN thuê bot!", threadID, safeMsgID);
      }

      const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
      const expireDate = new Date(data[threadID].expire).toLocaleDateString("vi-VN");
      return api.sendMessage(`📌 Thông tin thuê bot nhóm:\n⏱️ Ngày hết hạn: ${expireDate}\n⏳ Còn lại: ${daysLeft} ngày`, threadID, safeMsgID);
    }

    // 3. Xem danh sách nhóm đã thuê: /thuebot list
    if (subCommand === "list") {
      let msg = "📜 [ DANH SÁCH NHÓM THUÊ BOT ]\n─────────────\n";
      let count = 0;

      for (const [id, info] of Object.entries(data)) {
        count++;
        const expireDate = new Date(info.expire).toLocaleDateString("vi-VN");
        const status = info.expire > Date.now() ? "✅ Còn hạn" : "❌ Hết hạn";
        msg += `${count}. ID: ${id}\n   • Hạn dùng: ${expireDate} (${status})\n`;
      }

      if (count === 0) msg += "Chưa có nhóm nào thuê bot!";
      return api.sendMessage(msg, threadID, safeMsgID);
    }

    return api.sendMessage("📌 Cú pháp:\n👉 /thuebot add <số_ngày> (Kích hoạt cho nhóm hiện tại)\n👉 /thuebot add <số_ngày> <ID_nhóm> (Kích hoạt từ xa)\n👉 /thuebot check (Xem hạn dùng nhóm)\n👉 /thuebot list (Danh sách nhóm đã thuê)", threadID, safeMsgID);
  }
};