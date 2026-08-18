const login = require("fca-unofficial");
const fs = require("fs-extra");
const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Bot Facebook đang chạy!"));
app.listen(PORT, () => console.log(`[ SERVER ] Running on port ${PORT}`));

let config = { PREFIX: "/", BOTNAME: "Bot FB" };
try {
  if (fs.existsSync("./config.json")) {
    config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
  }
} catch (e) {}

let appStatePath = "./appstate.json";
if (!fs.existsSync(appStatePath) && fs.existsSync("./appState.json")) {
  appStatePath = "./appState.json";
}

if (!fs.existsSync(appStatePath)) {
  console.error("❌ Không tìm thấy appstate.json!");
  process.exit(1);
}

const appState = JSON.parse(fs.readFileSync(appStatePath, "utf-8"));
const commands = new Map();
const aliases = new Map();

// Nạp lệnh
const cmdDirPath = path.join(__dirname, "modules", "commands");
if (fs.existsSync(cmdDirPath)) {
  const files = fs.readdirSync(cmdDirPath).filter(f => f.endsWith(".js"));
  for (const file of files) {
    try {
      const filePath = path.join(cmdDirPath, file);
      delete require.cache[require.resolve(filePath)];
      const cmd = require(filePath);
      const cmdName = cmd.config?.name || file.replace(".js", "").toLowerCase();
      commands.set(cmdName.toLowerCase(), cmd);
      if (cmd.config?.aliases) {
        cmd.config.aliases.forEach(a => aliases.set(a.toLowerCase(), cmdName.toLowerCase()));
      }
    } catch (e) {}
  }
}

// Khởi chạy FCA
login({ appState }, { forceLogin: true, listenEvents: true, logLevel: "silent" }, (err, api) => {
  if (err) return console.error("❌ Lỗi đăng nhập:", err);

  api.setOptions({
    listenEvents: true,
    selfListen: false,
    listenTyping: false,
    updatePresence: false
  });

  console.log(`[ HỆ THỐNG ] Bot [${config.BOTNAME}] đã kết nối thành công!`);

  api.listenMqtt(async (err, event) => {
    if (err) return;

    if (event.type === "message" && event.body) {
      const prefix = config.PREFIX || "/";
      if (!event.body.startsWith(prefix)) return;

      const args = event.body.slice(prefix.length).trim().split(/ +/);
      const commandInput = args.shift().toLowerCase();
      const realCmdName = aliases.get(commandInput) || commandInput;
      const command = commands.get(realCmdName);

      if (command) {
        try {
          // Tránh spam dồn dập
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          if (typeof command.run === "function") {
            await command.run({ api, event, args, config });
          } else if (typeof command.onStart === "function") {
            await command.onStart({ api, event, args, config });
          }
        } catch (e) {
          console.error(`Lỗi thực thi /${realCmdName}:`, e.message);
        }
      }
    }
  });
});