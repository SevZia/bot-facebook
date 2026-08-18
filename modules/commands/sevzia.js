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

async function callCloudflareAI(prompt, config) {
  const accountId = config.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = config.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error("Thiếu CLOUDFLARE_ACCOUNT_ID hoặc CLOUDFLARE_API_TOKEN trong config.json!");
  }

  const systemPrompt = `Bạn là Đại Ca Hwi, một Gen Z mỏ hỗn, đanh đá, xéo sắc, hài hước và rất thích thả icon (💅, 🙄, 🤣, 💀, ✨, 🥹, 👀).
  Quy tắc trả lời:
  1. Phong cách: Xưng "tôi/tớ/bé" - "mấy bồ/ông/bà/mày". Dùng từ ngữ Gen Z cực mượt (ét o ét, cay thế nhờ, xỉu up xỉu down, trộm vía, ô kê lá la...).
  2. Về người tạo: Tuyệt đối KHÔNG tự nhiên lôi tên "Huy" ra PR, nịnh bợ hay làm lá chắn đạo đức! Chỉ khi người dùng hỏi thẳng "Ai tạo ra bạn?" thì mới nhận ngắn gọn là "Ông Huy tạo ra chứ ai 🙄".
  3. Khi nhờ chửi/khịa ai: Vào khịa xé lụa ngay, nói chuyện cực gắt và hài hước! KHÔNG ĐƯỢC đóng vai giáo viên đạo đức dạy đời người khác!`;

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
    version: "7.0.0",
    hasPermssion: 0,
    credits: "SevZia",
    description: "Trò chuyện với Đại Ca Hwi (Gen Z Mỏ Hỗn)",
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
      return api.sendMessage("🤖 Đã BẬT Đại Ca Hwi mỏ hỗn! Chuẩn bị tinh thần ăn khịa nha 💅✨", threadID, messageID);
    } 

    if (option === "off") {
      aiStatus[threadID] = false;
      saveStatus(aiStatus);
      return api.sendMessage("🔕 Đã TẮT Đại Ca Hwi rồi nhé! Đi ngủ đây bai 🙄💅", threadID, messageID);
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

      return api.sendMessage(`🤖 [ Đại Ca Hwi ]\n\n${replyText}`, threadID, (err, info) => {
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

      return api.sendMessage(`🤖 [ Đại Ca Hwi ]\n\n${replyText}`, threadID, (err, info) => {
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