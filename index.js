const login = require("fca-project-orion");
const fs = require("fs-extra");
const path = require("path");
const express = require("express");

// User-Agent chuẩn trình duyệt Windows để tránh bị Facebook chặn IP máy chủ Render
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

// Khởi tạo Web Server giữ Render luôn Live
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot Facebook đang hoạt động mượt mà!");
});

app.listen(PORT, () => {
  console.log(`[ SERVER ] Web server đang lắng nghe tại cổng ${PORT}`);
});

// Đọc Config an toàn
let config = { PREFIX: "/", BOTNAME: "Bot FB" };
try {
  if (fs.existsSync("./config.json")) {
    config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
  }
} catch (e) {
  console.error("⚠️ Không đọc được config.json, dùng config mặc định.");
}

// Tìm file AppState
let appStatePath = "./appstate.json";
if (!fs.existsSync(appStatePath) && fs.existsSync("./appState.json")) {
  appStatePath = "./appState.json";
}

if (!fs.existsSync(appStatePath)) {
  console.error(`❌ LỖI CHÍ MẠNG: Không tìm thấy file cookie (${appStatePath})! Vui lòng đẩy file appstate.json lên GitHub.`);
  process.exit(1);
}

let appState;
try {
  const rawState = JSON.parse(fs.readFileSync(appStatePath, "utf-8"));
  
  // Tự động chuẩn hóa key và ép domain về facebook.com để tránh lỗi CookieJar/MQTT
  appState = rawState.map(item => ({
    ...item,
    key: item.key || item.name,
    domain: "facebook.com"
  }));
} catch (e) {
  console.error("❌ LỖI: File appstate.json bị hỏng hoặc không đúng định dạng JSON!");
  process.exit(1);
}

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
      delete require.cache[require.resolve(filePath)];
      const cmd = require(filePath);

      const configData = cmd.config || (cmd.default && cmd.default.config);
      const cmdName = configData?.name || file.replace(".js", "").toLowerCase();

      commands.set(cmdName.toLowerCase(), cmd);

      if (configData?.aliases && Array.isArray(configData.aliases)) {
        configData.aliases.forEach(a => aliases.set(a.toLowerCase(), cmdName.toLowerCase()));
      }

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

// Tùy chọn đăng nhập
const loginOptions = {
  appState: appState
};

const fcaOptions = {
  forceLogin: true,
  listenEvents: true,
  logLevel: "silent",
  userAgent: USER_AGENT
};

login(loginOptions, fcaOptions, (err, api) => {
  if (err) return console.error("❌ Lỗi đăng nhập Facebook:", err);

  api.setOptions({
    listenEvents: true,
    selfListen: false,
    listenTyping: false,
    updatePresence: false,
    forceLogin: true,
    userAgent: USER_AGENT
  });

  console.log(`[ HỆ THỐNG ] Bot [${config.BOTNAME || "FB"}] đã sẵn sàng hoạt động!\n`);

  api.listenMqtt(async (err, event) => {
    if (err) {
      console.error("Lỗi MQTT:", err);
      return;
    }

    for (const handler of eventHandlers) {
      try {
        if (handler.handleEvent) handler.handleEvent({ api, event, config });
        if (handler.onEvent) handler.onEvent({ api, event, config });
      } catch (e) {}
    }

    if ((event.type === "message" || event.type === "message_reply") && event.body) {
      const prefix = config.PREFIX || "/";
      if (!event.body.startsWith(prefix)) return;

      const args = event.body.slice(prefix.length).trim().split(/ +/);
      const commandInput = args.shift().toLowerCase();

      const realCmdName = aliases.get(commandInput) || commandInput;
      const command = commands.get(realCmdName);

      if (command) {
        try {
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