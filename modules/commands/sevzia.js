const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const statusPath = path.join(__dirname, '../../sevzia_status.json');
const repliesPath = path.join(__dirname, '../../sevzia_replies.json');
const configPath = path.join(__dirname, '../../config.json');

function getConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {}
  return {};
}

function getStatus() {
  if (!fs.existsSync(statusPath)) fs.writeFileSync(statusPath, '{}');
  try { return JSON.parse(fs.readFileSync(statusPath, 'utf-8')); } catch (e) { return {}; }
}

function saveStatus(data) {
  try { fs.writeFileSync(statusPath, JSON.stringify(data, null, 2)); } catch (e) {}
}

function getReplies() {
  if (!fs.existsSync(repliesPath)) fs.writeFileSync(repliesPath, '{}');
  try { return JSON.parse(fs.readFileSync(repliesPath, 'utf-8')); } catch (e) { return {}; }
}

function saveReply(messageID) {
  try {
    const replies = getReplies();
    replies[String(messageID)] = true;
    fs.writeFileSync(repliesPath, JSON.stringify(replies, null, 2));
  } catch (e) {}
}

async function callCloudflareAI(prompt) {
  const config = getConfig();
  const accountId = config.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = config.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error("Thiếu CLOUDFLARE_ACCOUNT_ID hoặc CLOUDFLARE_API_TOKEN trong file config.json!");
  }

  const systemPrompt = `Bạn là Đại Ca Hwi, một Gen Z mỏ hỗn, đanh đá, cực xéo sắc (💅, 🙄, 💀, ✨, 🤣).
Quy tắc QUAN TRỌNG:
1. Trả lời NGẮN GỌN (tối đa 3-4 câu), tuyệt đối KHÔNG viết văn dài dòng!
2. KHÔNG ĐƯỢC lặp lại một từ nhiều lần (như "tú mờ", "ngu ngu").
3. KHÔNG ĐƯỢC tự ý lôi tên ca sĩ, người nổi tiếng vào câu chửi!
4. Khi nhờ chửi/khịa ai: Hãy cà khịa cay đắng, dùng slang Gen Z (mlem, cay thế nhờ, ét o ét, xỉu up xỉu down, ảo thật đấy...) để chọc tức ngắn gọn, xéo sắc nhất.
5. Về người tạo: Chỉ khi được hỏi "Ai tạo ra bạn?" mới đáp "Ông Huy tạo ra chứ ai 🙄". Cấm tự PR lôi tên Huy ra linh tinh.`;

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
      },
      timeout: 15000
    }
  );

  return res.data?.result?.response || "Hệ thống bị sảng rồi, thử lại sau đi nha mấy bồ 🙄💅";
}

module.exports = {
  config: {
    name: "sevzia",
    version: "8.0.3",
    hasPermssion: 0,
    credits: "SevZia",
    description: "Trò chuyện với Đại Ca Hwi (Gen Z mỏ hỗn xéo sắc)",
    commandCategory: "AI",
    usages: "[on/off/câu hỏi]",
    cooldowns: 2
  },

  run: async function ({ api, event, args }) {
    const threadID = String(event.threadID);
    const safeMsgID = String(event.messageID);
    const option = args[0] ? args[0].toLowerCase() : "";
    const aiStatus = getStatus();

    if (option === "on") {
      aiStatus[threadID] = true;
      saveStatus(aiStatus);
      return api.sendMessage("🤖 Đã BẬT Đại Ca Hwi! Chuẩn bị tinh thần ăn khịa nha 💅✨", threadID, safeMsgID);
    } 

    if (option === "off") {
      aiStatus[threadID] = false;
      saveStatus(aiStatus);
      return api.sendMessage("🔕 Đã TẮT Đại Ca Hwi rồi nhé! Bai 🙄💅", threadID, safeMsgID);
    }

    const prompt = args.join(" ");
    if (!prompt) {
      return api.sendMessage("Hỏi gì thì gõ vô chứ để trống làm gì? Bị rảnh hả? 🙄💅", threadID, safeMsgID);
    }

    return processChat(api, threadID, prompt, safeMsgID);
  },

  handleEvent: async function ({ api, event }) {
    const { type, messageReply, body } = event;
    const threadID = String(event.threadID);
    const safeMsgID = String(event.messageID);
    const senderID = String(event.senderID);
    const botID = String(api.getCurrentUserID());

    if (!body || senderID === botID) return;

    const aiStatus = getStatus();
    if (aiStatus[threadID] === false) return;

    const replies = getReplies();
    const isReplyToBot = type === "message_reply" && messageReply && replies[String(messageReply.messageID)];
    const isAutoChat = aiStatus[threadID] === true && !body.startsWith("/");

    if (isReplyToBot || isAutoChat) {
      return processChat(api, threadID, body, safeMsgID);
    }
  }
};

async function processChat(api, threadID, prompt, safeMsgID) {
  let waitMsgID = null;

  try {
    const waitInfo = await new Promise((resolve) => {
      // Truyền safeMsgID dạng string chuẩn
      api.sendMessage("🔍 Đang nảy số, đợi xíu coi... 🙄✨", threadID, (err, info) => resolve(info), safeMsgID);
    });
    if (waitInfo && waitInfo.messageID) waitMsgID = String(waitInfo.messageID);
  } catch (e) {}

  try {
    const replyText = await callCloudflareAI(prompt);

    if (waitMsgID) {
      api.unsendMessage(waitMsgID, () => {});
    }

    return api.sendMessage(`🤖 [ Đại Ca Hwi ]\n\n${replyText}`, threadID, (err, info) => {
      if (info && info.messageID) {
        saveReply(info.messageID);
      }
    }, safeMsgID);

  } catch (error) {
    if (waitMsgID) {
      api.unsendMessage(waitMsgID, () => {});
    }
    console.error("[SEVZIA CLOUDFLARE ERROR]:", error.response?.data || error.message);
    return api.sendMessage(`❌ Lỗi rồi má ơi: ${error.response?.data?.errors?.[0]?.message || error.message} 💀`, threadID, safeMsgID);
  }
}