const login = require("fca-unofficial");
const fs = require("fs-extra");
const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot Facebook đang hoạt động!");
});

app.listen(PORT, () => {
  console.log(`[ SERVER ] Web server đang lắng nghe tại cổng ${PORT}`);
});

// Nạp config.json
let config = { PREFIX: "/", BOTNAME: "Bot FB" };
try {
  if (fs.existsSync("./config.json")) {
    config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
  }
} catch (e) {}

// Kiểm tra appstate.json
let appStatePath = "./appstate.json";
if (!fs.existsSync(appStatePath) && fs.existsSync("./appState.json")) {
  appStatePath = "./appState.json";
}

if (!fs.existsSync(appStatePath)) {
  console.error("❌ LỖI: Không tìm thấy file appstate.json!");
  process.exit(1);
}

let appState;
try {
  appState = JSON.parse(fs.readFileSync(appStatePath, "utf-8"));
} catch (e) {
  console.error("❌ LỖI: File appstate.json bị hỏng!");
  process.exit(1);
}

// Nạp commands và aliases
const commands = new Map();
const aliases = new Map();
const eventHandlers = [];

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
}

// Giả lập User-Agent trình duyệt thật để bypass chặn IP từ Render
const options = {
  forceLogin: true,
  listenEvents: true,
  logLevel: "silent",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
};

login({ appState }, options, (err, api) => {
  if (err) {
    console.error("❌ Lỗi đăng nhập Facebook:", err);
    return;
  }

  api.setOptions({
    listenEvents: true,
    selfListen: false,
    listenTyping: false,
    updatePresence: false,
    forceLogin: true
  });

  console.log(`[ HỆ THỐNG ] Bot [${config.BOTNAME || "FB"}] đã sẵn sàng hoạt động!\n`);

  api.listenMqtt(async (err, event) => {
    if (err) return console.error("Lỗi MQTT:", err);

    // Xử lý các sự kiện (khi có thành viên mới, out nhóm,...)
    for (const handler of eventHandlers) {
      try {
        if (handler.handleEvent) handler.handleEvent({ api, event, config });
        if (handler.onEvent) handler.onEvent({ api, event, config });
      } catch (e) {}
    }

    // Xử lý lệnh nhắn tin
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