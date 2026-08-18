module.exports = {
  name: "menu",
  run: async function ({ api, event }) {
    return api.sendMessage("📌 Danh sách lệnh đang hoạt động:\n1. /menu - Xem danh sách lệnh\n2. /thuebot - Quản lý thuê bot", event.threadID, event.messageID);
  }
};