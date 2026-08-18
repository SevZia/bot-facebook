const express = require("express");
const { login } = require("ws3-fca");
const fs = require("fs-extra");
const path = require("path");

// --- TẠO WEB SERVER ĐỂ RENDER BIND PORT (TRÁNH BỊ TREO DEPLOY) ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot Facebook đang chạy ngon lành!");
});

app.listen(PORT, () => {
  console.log(`🌐 Server HTTP đang lắng nghe trên cổng ${PORT}`);
});

// --- CODE CHẠY BOT FACEBOOK ---
let appState;

// 1. Ưu tiên đọc từ biến môi trường APPSTATE của Render
if (process.env.APPSTATE) {
  try {
    appState = JSON.parse(process.env.APPSTATE);
  } catch (e) {
    console.error("❌ Biến môi trường APPSTATE bị sai định dạng JSON!");
    process.exit(1);
  }
} else {
  // 2. Nếu không có biến môi trường thì tìm file appstate.json ở local
  const appStatePath = path.join(__dirname, "appstate.json");
  if (fs.existsSync(appStatePath)) {
    try {
      appState = JSON.parse(fs.readFileSync(appStatePath, "utf8"));
    } catch (e) {
      console.error("❌ File appstate.json bị lỗi định dạng JSON:", e.message);
      process.exit(1);
    }
  } else {
    console.error("❌ Không tìm thấy biến APPSTATE trên Render hoặc file appstate.json!");
    process.exit(1);
  }
}

const options = {
  forceLogin: true,
  listenEvents: true,
  logLevel: "silent",
  selfListen: false,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
};

console.log("[ HỆ THỐNG ] Đang kết nối tới Facebook...");

login({ appState }, options, (err, api) => {
  if (err) {
    console.error("❌ Đăng nhập thất bại:", err.message || err);
    return;
  }

  api.setOptions({
    listenEvents: true,
    selfListen: false,
    listenTyping: false,
    updatePresence: false,
    forceLogin: true
  });

  console.log("------------------------------------------");
  console.log("✅ ĐÃ ĐĂNG NHẬP THÀNH CÔNG BOT FACEBOOK!");
  console.log(`🤖 ID Bot: ${api.getCurrentUserID()}`);
  console.log("------------------------------------------");

  // Load danh sách lệnh
  const commands = new Map();
  const cmdDir = path.join(__dirname, "modules", "commands");

  if (fs.existsSync(cmdDir)) {
    const files = fs.readdirSync(cmdDir).filter(f => f.endsWith(".js"));
    for (const file of files) {
      try {
        const cmd = require(path.join(cmdDir, file));
        if (cmd.config && cmd.config.name) {
          commands.set(cmd.config.name.toLowerCase(), cmd);
          if (cmd.config.aliases && Array.isArray(cmd.config.aliases)) {
            for (const alias of cmd.config.aliases) {
              commands.set(alias.toLowerCase(), cmd);
            }
          }
        }
      } catch (e) {
        console.error(`❌ Lỗi load file lệnh ${file}:`, e.message);
      }
    }
  }

  api.listenMqtt(async (err, event) => {
    if (err) {
      console.error("❌ Lỗi MQTT:", err);
      return;
    }

    // Chạy handleEvent cho tất cả các file có hàm này
    for (const [, cmd] of commands) {
      if (typeof cmd.handleEvent === "function") {
        try {
          await cmd.handleEvent({ api, event });
        } catch (e) {
          console.error("Lỗi handleEvent:", e);
        }
      }
    }

    // Xử lý lệnh có dấu /
    if (event.body) {
      const text = event.body.trim();
      if (text.startsWith("/")) {
        const args = text.slice(1).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        if (commands.has(commandName)) {
          const cmd = commands.get(commandName);
          try {
            await cmd.run({ api, event, args });
          } catch (e) {
            console.error(`Lỗi chạy lệnh /${commandName}:`, e);
          }
        }
      }
    }
  });
});