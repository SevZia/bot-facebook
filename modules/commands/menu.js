module.exports.config = {
  name: "help",
  aliases: ["menu", "caclenh", "commands"],
  version: "1.0.0",
  hasPermssion: 0,
  credits: "BotFB",
  description: "Xem danh sách toàn bộ lệnh bot đang có",
  commandCategory: "Hệ thống",
  usages: "[tên lệnh]",
  cooldowns: 2
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const safeMsgID = "" + messageID;

  if (args[0]) {
    const commandName = args[0].toLowerCase();
    const command = api.commands?.get(commandName) || api.commands?.get(api.aliases?.get(commandName));

    if (!command) {
      return api.sendMessage(`❌ Không tìm thấy lệnh "${commandName}" trong hệ thống!`, threadID, safeMsgID);
    }

    const config = command.config;
    let detailMsg = `📌 [ CHI TIẾT LỆNH: /${config.name} ]\n─────────────\n`;
    detailMsg += `📝 Mô tả: ${config.description || "Không có"}\n`;
    detailMsg += `💡 Cú pháp: /${config.name} ${config.usages || ""}\n`;
    detailMsg += `⏱️ Cooldown: ${config.cooldowns || 1}s\n`;
    detailMsg += `🔒 Quyền hạn: ${config.hasPermssion === 0 ? "Thành viên" : config.hasPermssion === 1 ? "QTV Nhóm" : "Admin Bot"}\n`;
    if (config.aliases && config.aliases.length > 0) {
      detailMsg += `🔗 Tên gọi khác: ${config.aliases.join(", ")}\n`;
    }

    return api.sendMessage(detailMsg, threadID, safeMsgID);
  }

  let msg = `🤖 [ DANH SÁCH LỆNH BOT ĐANG DÙNG ]\n─────────────\n\n`;

  msg += `🎮 **1. Tương tác & Giải trí**\n`;
  msg += `• /tat [@tag/reply] - Tát đứa ngáo ngơ\n`;
  msg += `• /da [@tag/reply] - Tung cú đá tiễn lên đọt dừa\n`;
  msg += `• /hon [@tag/reply] - Cưỡng hôn chụt chụt\n`;
  msg += `• /om [@tag/reply] - Ôm siết gãy xương sườn\n\n`;

  msg += `📌 **2. Quản lý Nhóm**\n`;
  msg += `• /setname <tên> - Đổi biệt danh bản thân\n`;
  msg += `• /setname [@tag/reply] <tên> - Đổi biệt danh người khác\n`;
  msg += `• /setname checksn - Kiểm tra ai chưa đổi tên\n`;
  msg += `• /setname list - Xem danh sách biệt danh\n\n`;

  msg += `💤 **3. Trạng thái Vắng mặt**\n`;
  msg += `• /afk <lý do> - Bật chế độ treo máy (tự tắt khi chat lại)\n\n`;

  msg += `💬 **4. Trò chuyện AI (Gen Z)**\n`;
  msg += `• /sevzia on/off - Bật/Tắt AI nói chuyện\n`;
  msg += `• /sevzia <nội dung> - Hỏi đáp xéo sắc với AI\n\n`;

  msg += `🔑 **5. Hệ thống & Thuê Bot**\n`;
  msg += `• /thuebot check - Xem hạn dùng bot của nhóm\n`;
  msg += `• /help <tên lệnh> - Xem chi tiết cách dùng lệnh\n`;
  msg += `─────────────\n👉 Gõ /help <tên lệnh> để xem chi tiết từng lệnh!`;

  return api.sendMessage(msg, threadID, safeMsgID);
};