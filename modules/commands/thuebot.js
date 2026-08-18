const fs = require("fs-extra");
const path = "./modules/commands/thuebot.json";

module.exports = {
  name: "thuebot",
  run: async function ({ api, event, args, config }) {
    const { threadID, senderID, messageID } = event;
    if (!config.ADMINBOT.includes(senderID)) {
      return api.sendMessage("⚠️ Chỉ Admin Bot mới có quyền dùng lệnh này!", threadID, messageID);
    }
    if (!fs.existsSync(path)) fs.outputJsonSync(path, {});
    let data = fs.readJsonSync(path);

    if (args[0] === "add") {
      const days = parseInt(args[1]) || 30;
      data[threadID] = { expire: Date.now() + days * 24 * 60 * 60 * 1000 };
      fs.writeJsonSync(path, data);
      return api.sendMessage(`✅ Đã kích hoạt cho thuê nhóm [${threadID}] trong ${days} ngày!`, threadID, messageID);
    }
    return api.sendMessage("📌 Cú pháp: /thuebot add <số_ngày>", threadID, messageID);
  }
};