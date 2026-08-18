const login = require("@dongdev/fca-unofficial");
const fs = require("fs-extra");
const path = require("path");
const express = require("express");

// Khởi tạo Web Server để giữ Render luôn Live
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot Facebook đang hoạt động mượt mà!");
});

app.listen(PORT, () => {
  console.log(`[ SERVER ] Web server đang lắng nghe tại cổng ${PORT}`);
});

const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
let appState = JSON.parse(fs.readFileSync("./appstate.json", "utf-8"));

const commands = new Map();
const aliases = new Map();
const eventHandlers = [];

// Quét toàn bộ file lệnh trong modules/commands
const cmdDirPath = path.join(__dirname, "modules", "commands");

if (fs.existsSync(cmdDirPath)) {
  const files = fs.readdirSync(cmdDirPath).filter(f => f.endsWith(".js"));
  
  for (const file of files) {
    try {
      const filePath = path.join(cmdDirPath, file);
      // Xóa cache để cập nhật file ngay lập tức
      delete require.cache[require.resolve(filePath)];
      const cmd = require(filePath);

      // Đọc cấu hình của lệnh
      const configData = cmd.config || (cmd.default && cmd.default.config);
      const cmdName = configData?.name || file.replace(".js", "").toLowerCase();

      commands.set(cmdName.toLowerCase(), cmd);

      // Lưu tên viết tắt (Aliases)
      if (configData?.aliases && Array.isArray(configData.aliases)) {
        configData.aliases.forEach(a => aliases.set(a.toLowerCase(), cmdName.toLowerCase()));
      }

      // Lưu xử lý sự kiện ngầm (Event Reply/HandleEvent/Auto)
      if (cmd.handleEvent || cmd.onEvent || cmd.handleReply) {
        eventHandlers.push(cmd);
      }
    } catch (e) {
      console.error(`❌ Lỗi tải lệnh [${file}]:`, e.message);
    }
  }
  console.log(`\n[ HỆ THỐNG ] Đã nạp thành công ${commands.size} lệnh và ${aliases.size} tên viết tắt!`);
} else {
  console.error("❌ Không tìm thấy thư mục modules/commands!");
}

login({ appState }, (err, api) => {
  if (err) return console.error("❌ Lỗi đăng nhập Facebook:", err);

  api.setOptions({
    listenEvents: true,
    selfListen: false,
    listenTyping: false,
    updatePresence: false,
    forceLogin: true
  });

  console.log(`[ HỆ THỐNG ] Bot [${config.BOTNAME}] đã sẵn sàng hoạt động!\n`);

  api.listenMqtt(async (err, event) => {
    if (err) return console.error("Lỗi MQTT:", err);

    // 1. Tự động thực thi các lệnh chạy ngầm (Auto TikTok, AutoRep, Check tương tác...)
    for (const handler of eventHandlers) {
      try {
        if (handler.handleEvent) handler.handleEvent({ api, event, config });
        if (handler.onEvent) handler.onEvent({ api, event, config });
      } catch (e) {
        // Bỏ qua lỗi sự kiện ngầm để không gián đoạn bot
      }
    }

    // 2. Xử lý tin nhắn chứa Prefix (Lệnh chính)
    if ((event.type === "message" || event.type === "message_reply") && event.body) {
      if (!event.body.startsWith(config.PREFIX)) return;

      const args = event.body.slice(config.PREFIX.length).trim().split(/ +/);
      const commandInput = args.shift().toLowerCase();

      // Tìm lệnh qua tên chính hoặc tên viết tắt (Alias)
      const realCmdName = aliases.get(commandInput) || commandInput;
      const command = commands.get(realCmdName);

      if (command) {
        try {
          // Khởi chạy hàm tương ứng với cấu trúc file lệnh
          if (typeof command.run === "function") {
            await command.run({ api, event, args, config });
          } else if (typeof command.onStart === "function") {
            await command.onStart({ api, event, args, config });
          } else if (typeof command.execute === "function") {
            await command.execute({ api, event, args, config });
          }
        } catch (e) {
          console.error(`Lỗi thực thi /${realCmdName}:`, e);
          api.sendMessage(`❌ Lỗi thực thi lệnh /${realCmdName}: ${e.message}`, event.threadID, event.messageID);
        }
      }
    }
  });
});