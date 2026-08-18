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

  const res = await axios.post(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
    {
      messages: [
        { role: "system", content: "Bạn là Sevzia AI, một trợ lý thông minh và thân thiện." },
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

  return res.data?.result?.response || "Không nhận được phản hồi từ Cloudflare AI.";
}

module.exports = {
  config: {
    name: "sevzia",
    version: "5.0.0",
    hasPermssion: 0,
    credits: "SevZia",
    description: "Trò chuyện với Cloudflare AI (Bắt Event Reply trực tiếp)",
    commandCategory: "AI",
    usages: "[on/off/câu hỏi]",
    cooldowns: 2
  },

  // 1. Chạy khi gõ /sevzia
  run: async function ({ api, event, args, config }) {
    const { threadID, messageID } = event;
    const option = args[0] ? args[0].toLowerCase() : "";
    const aiStatus = getStatus();

    if (option === "on") {
      aiStatus[threadID] = true;
      saveStatus(aiStatus);
      return api.sendMessage("🤖 Đã BẬT tính năng Sevzia AI cho nhóm này!", threadID, messageID);
    } 

    if (option === "off") {
      aiStatus[threadID] = false;
      saveStatus(aiStatus);
      return api.sendMessage("🔕 Đã TẮT tính năng Sevzia AI cho nhóm này!", threadID, messageID);
    }

    if (aiStatus[threadID] === false) {
      return api.sendMessage("⚠️ Sevzia AI đang ở trạng thái TẮT. Dùng '/sevzia on' để bật lại nhé!", threadID, messageID);
    }

    const prompt = args.join(" ");
    if (!prompt) {
      return api.sendMessage("Dùng: /sevzia on (bật), /sevzia off (tắt) hoặc /sevzia [câu hỏi]", threadID, messageID);
    }

    let waitMsgID = null;
    try {
      const waitInfo = await new Promise((resolve) => {
        api.sendMessage("🔍 Sevzia đang suy nghĩ...", threadID, (err, info) => resolve(info), messageID);
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
      return api.sendMessage(`❌ Lỗi kết nối Cloudflare AI: ${error.message}`, threadID, messageID);
    }
  },

  // 2. Bắt sự kiện Reply trực tiếp bất kể core bot như thế nào
  handleEvent: async function ({ api, event, config }) {
    const { type, messageReply, body, threadID, messageID } = event;

    // Chỉ xử lý nếu là tin nhắn reply và có nội dung
    if (type !== "message_reply" || !messageReply || !body) return;

    const replies = getReplies();
    // Kiểm tra xem tin nhắn được reply có phải do Sevzia AI gửi ra không
    if (!replies[messageReply.messageID]) return;

    const aiStatus = getStatus();
    if (aiStatus[threadID] === false) return;

    let waitMsgID = null;
    try {
      const waitInfo = await new Promise((resolve) => {
        api.sendMessage("🔍 Sevzia đang suy nghĩ...", threadID, (err, info) => resolve(info), messageID);
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
      return api.sendMessage(`❌ Lỗi Cloudflare AI: ${error.message}`, threadID, messageID);
    }
  }
};