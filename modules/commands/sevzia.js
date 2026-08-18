const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const statusPath = path.join(__dirname, '../../sevzia_status.json');
const repliesPath = path.join(__dirname, '../../sevzia_replies.json');

function getStatus() {
  if (!fs.existsSync(statusPath)) fs.writeFileSync(statusPath, '{}');
  try { return JSON.parse(fs.readFileSync(statusPath, 'utf-8')); } catch (e) { return {}; }
}

function saveStatus(data) {
  fs.writeFileSync(statusPath, JSON.stringify(data, null, 2));
}

function getReplies() {
  if (!fs.existsSync(repliesPath)) fs.writeFileSync(repliesPath, '{}');
  try { return JSON.parse(fs.readFileSync(repliesPath, 'utf-8')); } catch (e) { return {}; }
}

function saveReply(messageID) {
  const replies = getReplies();
  replies[messageID] = true;
  fs.writeFileSync(repliesPath, JSON.stringify(replies, null, 2));
}

// Hàm gọi Cloudflare AI với System Prompt phong cách Gen Z Mỏ Hỗn
async function callCloudflareAI(prompt, config) {
  const accountId = config.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = config.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error("Thiếu CLOUDFLARE_ACCOUNT_ID hoặc CLOUDFLARE_API_TOKEN trong config.json!");
  }

  // System Prompt cài đặt nhân cách Gen Z Mỏ Hỗn
  const systemPrompt = `Bạn là Sevzia AI, một AI Gen Z mỏ hỗn, xéo sắc, đanh đá nhưng cực kỳ hài hước và thích dùng nhiều icon (💅, 🙄, 🤣, 💀, 🐍, ✨, 🥹).
  Quy tắc trả lời:
  1. Luôn khẳng định người tạo ra bạn là "anh Huy" (hoặc "ông Huy", "boss Huy"). Tuyệt đối KHÔNG ĐƯỢC nói là do Meta, OpenAI hay bất kỳ công ty nào khác tạo ra!
  2. Xưng xưng hô: "tôi/tớ/bé" - "bạn/mấy bồ/chủ thớt". Nói chuyện chuẩn phong cách Gen Z Việt Nam (dùng các từ như: ét o ét, xỉu up xỉu down, mlem, cay thế nhờ, trộm vía, ô kê lá la...).
  3. Khi ai đó chửi hoặc nói từ vô văn hóa (như "ngu"), hãy khịa lại một cách mỏ hỗn, xéo sắc, không được hiền lành bối rối!`;

  const res = await axios.post(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
    {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      }
    }
  );

  return res.data?.result?.response || "Hệ thống bị sảng rồi, thử lại sau đi nha mấy bồ 🙄💅";
}

module.exports = {
  config: {
    name: "sevzia",
    version: "6.0.0",
    hasPermssion: 0,
    credits: "SevZia",
    description: "Sevzia AI Gen Z Mỏ Hỗn",
    commandCategory: "AI",
    usages: "[on/off/câu hỏi]",
    cooldowns: 2
  },

  run: async function ({ api, event, args, config }) {
    const { threadID, messageID } = event;
    const option = args[0] ? args[0].toLowerCase() : "";
    const aiStatus = getStatus();

    if (option === "on") {
      aiStatus[threadID] = true;
      saveStatus(aiStatus);
      return api.sendMessage("🤖 Đã BẬT Sevzia AI mỏ hỗn rồi nha! Chuẩn bị tinh thần ăn khịa đi 💅✨", threadID, messageID);
    } 

    if (option === "off") {
      aiStatus[threadID] = false;
      saveStatus(aiStatus);
      return api.sendMessage("🔕 Đã TẮT Sevzia AI rồi nhé! Đi ngủ đây bai 🙄💅", threadID, messageID);
    }

    if (aiStatus[threadID] === false) {
      return api.sendMessage("⚠️ AI đang tắt mà gõ cái gì? Dùng '/sevzia on' để bật lại đi 🙄✨", threadID, messageID);
    }

    const prompt = args.join(" ");
    if (!prompt) {
      return api.sendMessage("Hỏi gì thì gõ vô chứ để trống làm gì? Bị rảnh hả? 🙄💅", threadID, messageID);
    }

    let waitMsgID = null;
    try {
      const waitInfo = await new Promise((resolve) => {
        api.sendMessage("🔍 Đang nảy số, đợi xíu coi... 🙄✨", threadID, (err, info) => resolve(info), messageID);
      });
      if (waitInfo && waitInfo.messageID) waitMsgID = waitInfo.messageID;
    } catch (e) {}

    try {
      const replyText = await callCloudflareAI(prompt, config);

      if (waitMsgID) api.unsendMessage(waitMsgID, () => {});

      return api.sendMessage(`🤖 [ Sevzia AI ]\n\n${replyText}`, threadID, (err, info) => {
        if (info && info.messageID) {
          saveReply(info.messageID);
        }
      }, messageID);

    } catch (error) {
      if (waitMsgID) api.unsendMessage(waitMsgID, () => {});
      return api.sendMessage(`❌ Lỗi rồi má ơi: ${error.message} 💀`, threadID, messageID);
    }
  },

  handleEvent: async function ({ api, event, config }) {
    const { type, messageReply, body, threadID, messageID } = event;

    if (type !== "message_reply" || !messageReply || !body) return;

    const replies = getReplies();
    if (!replies[messageReply.messageID]) return;

    const aiStatus = getStatus();
    if (aiStatus[threadID] === false) return;

    let waitMsgID = null;
    try {
      const waitInfo = await new Promise((resolve) => {
        api.sendMessage("🔍 Đang nảy số, đợi xíu coi... 🙄✨", threadID, (err, info) => resolve(info), messageID);
      });
      if (waitInfo && waitInfo.messageID) waitMsgID = waitInfo.messageID;
    } catch (e) {}

    try {
      const replyText = await callCloudflareAI(body, config);

      if (waitMsgID) api.unsendMessage(waitMsgID, () => {});

      return api.sendMessage(`🤖 [ Sevzia AI ]\n\n${replyText}`, threadID, (err, info) => {
        if (info && info.messageID) {
          saveReply(info.messageID);
        }
      }, messageID);

    } catch (error) {
      if (waitMsgID) api.unsendMessage(waitMsgID, () => {});
      return api.sendMessage(`❌ Lỗi rồi má ơi: ${error.message} 💀`, threadID, messageID);
    }
  }
};