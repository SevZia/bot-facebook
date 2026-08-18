const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "admin_config.json");

function getAdminConfig() {
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (e) {
    return {};
  }
}

function saveAdminConfig(data) {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), "utf-8");
}

module.exports.config = {
  name: "admin",
  aliases: ["qtv", "qtvonly", "admode"],
  version: "2.2.0",
  hasPermssion: 0,
  credits: "BotFB",
  description: "Đồng bộ chuẩn tất cả QTV thật & Tự xóa tin nhắn khi thả tim",
  commandCategory: "Quản lý nhóm",
  usages: "[reset / sync / on / off / add / remove / list]",
  cooldowns: 1
};

// TỰ ĐỘNG XÓA TIN NHẮN KHI CÓ NGƯỜI THẢ TIM KHÔNG PHÂN BIỆT ICON
module.exports.handleEvent = async function ({ api, event }) {
  if (event.type === "message_reaction") {
    const { messageID, reaction } = event;
    const allowedReactions = ["❤", "💗", "💖", "👍", "❤️", "😍", "🥰"];

    if (allowedReactions.includes(reaction)) {
      api.unsendMessage(messageID, (err) => {
        if (err) console.error("Lỗi gỡ tin nhắn:", err);
      });
    }
  }
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID, mentions } = event;
  const status = args[0]?.toLowerCase();
  const config = getAdminConfig();

  if (!config[threadID]) {
    config[threadID] = {
      onlyAdmin: false,
      customAdmins: []
    };
  }

  try {
    // 1. CÚ PHÁP: /qtv reset HOẶC /qtv sync
    if (status === "reset" || status === "sync" || status === "refresh") {
      const threadInfo = await api.getThreadInfo(threadID);
      const adminIDs = threadInfo.adminIDs.map(item => item.id);

      if (adminIDs.length === 0) {
        return api.sendMessage("⚠️ Không lấy được danh sách QTV từ Facebook!", threadID, messageID);
      }

      config[threadID].customAdmins = adminIDs;
      saveAdminConfig(config);

      const usersInfo = await api.getUserInfo(adminIDs);
      let adminNames = [];
      for (const id of adminIDs) {
        const name = usersInfo[id]?.name || id;
        adminNames.push(`• ${name}`);
      }

      return api.sendMessage(
        `🔄 [ ĐÃ ĐỒNG BỘ ${adminIDs.length} QTV TỪ FACEBOOK ]\n─────────────\n` +
        `📌 Danh sách QTV Bot được cấp quyền:\n` +
        adminNames.join("\n") +
        `\n─────────────\n` +
        `✅ Tất cả ${adminIDs.length} QTV trên đều có quyền dùng các lệnh QTV của Bot!`,
        threadID,
        messageID
      );
    }

    // 2. CÚ PHÁP: /qtv add @tag
    if (status === "add") {
      let targetIDs = Object.keys(mentions);
      if (targetIDs.length === 0 && args[1]) targetIDs = [args[1]];

      if (targetIDs.length === 0) {
        return api.sendMessage("⚠️ Vui lòng tag hoặc nhập UID người cần thêm quyền QTV Bot!", threadID, messageID);
      }

      let addedCount = 0;
      for (const id of targetIDs) {
        if (!config[threadID].customAdmins.includes(id)) {
          config[threadID].customAdmins.push(id);
          addedCount++;
        }
      }
      saveAdminConfig(config);
      return api.sendMessage(`✅ Đã thêm quyền QTV Bot cho ${addedCount} người dùng!`, threadID, messageID);
    }

    // 3. CÚ PHÁP: /qtv remove @tag
    if (status === "remove" || status === "del") {
      let targetIDs = Object.keys(mentions);
      if (targetIDs.length === 0 && args[1]) targetIDs = [args[1]];

      if (targetIDs.length === 0) {
        return api.sendMessage("⚠️ Vui lòng tag người cần gỡ quyền QTV Bot!", threadID, messageID);
      }

      config[threadID].customAdmins = config[threadID].customAdmins.filter(id => !targetIDs.includes(id));
      saveAdminConfig(config);
      return api.sendMessage(`✅ Đã gỡ quyền QTV Bot của các người dùng được chọn!`, threadID, messageID);
    }

    // 4. BẬT CHẾ ĐỘ CHỈ QTV DÙNG BOT
    if (status === "on") {
      if (config[threadID].customAdmins.length === 0) {
        const threadInfo = await api.getThreadInfo(threadID);
        config[threadID].customAdmins = threadInfo.adminIDs.map(item => item.id);
      }
      config[threadID].onlyAdmin = true;
      saveAdminConfig(config);
      return api.sendMessage("🔒 Đã BẬT chế độ [Chỉ QTV dùng Bot]!", threadID, messageID);
    }

    // 5. TẮT CHẾ ĐỘ CHỈ QTV DÙNG BOT
    if (status === "off") {
      config[threadID].onlyAdmin = false;
      saveAdminConfig(config);
      return api.sendMessage("🔓 Đã TẮT chế độ QTV! Tất cả thành viên đều có thể dùng Bot.", threadID, messageID);
    }

    // 6. XEM DANH SÁCH QTV HIỆN TẠI
    if (status === "list") {
      const currentAdmins = config[threadID].customAdmins || [];
      if (currentAdmins.length === 0) {
        return api.sendMessage("⚠️ Hiện chưa có QTV nào trong danh sách Bot!", threadID, messageID);
      }
      const usersInfo = await api.getUserInfo(currentAdmins);
      let listMsg = currentAdmins.map((id, index) => `${index + 1}. ${usersInfo[id]?.name || id}`).join("\n");
      return api.sendMessage(`📌 [ DS QTV BOT HIỆN TẠI ]\n─────────────\n${listMsg}`, threadID, messageID);
    }

    const currentStatus = config[threadID].onlyAdmin ? "Đang BẬT 🔒" : "Đang TẮT 🔓";
    return api.sendMessage(
      `⚙️ [ QUẢN LÝ QUYỀN QTV BOT ]\n─────────────\n` +
      `📌 Chế độ chỉ QTV dùng Bot: ${currentStatus}\n` +
      `👥 Số QTV Bot hiện tại: ${config[threadID].customAdmins.length} người\n─────────────\n` +
      `👉 /qtv reset : Đồng bộ TẤT CẢ QTV thật của nhóm\n` +
      `👉 /qtv on / off : Bật/Tắt chế độ chỉ QTV\n` +
      `👉 /qtv list : Xem danh sách QTV Bot`,
      threadID,
      messageID
    );

  } catch (e) {
    return api.sendMessage(`❌ Lỗi: ${e.message}`, threadID, messageID);
  }
};