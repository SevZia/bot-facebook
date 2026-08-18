const axios = require("axios");

module.exports = {
  config: {
    name: "sevzia",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "Gemini",
    description: "Tương tác trò chuyện như người thật qua Cloudflare Workers AI",
    commandCategory: "AI",
    usages: "",
    cooldowns: 2
  },

  handleEvent: async function({ api, event }) {
    if (!event.body) return;
    const bodyText = event.body.toLowerCase();

    // Bắt từ khóa gọi bot
    if (bodyText.includes("sevzia ơi") || bodyText.includes("sevzia")) {
      const prompt = event.body.replace(/sevzia ơi|sevzia/gi, "").trim() || "Chào bạn!";

      // Cấu hình Cloudflare Workers AI
      const ACCOUNT_ID = "YOUR_CLOUDFLARE_ACCOUNT_ID"; // Thay Account ID của bạn
      const API_TOKEN = "YOUR_CLOUDFLARE_API_TOKEN";   // Thay API Token của bạn
      const MODEL = "@cf/meta/llama-3-8b-instruct";

      try {
        const response = await axios.post(
          `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`,
          {
            messages: [
              { role: "system", content: "Bạn là Sevzia, một người bạn trò chuyện hóm hỉnh, tự nhiên, thân thiện và xưng hô người thật trên Facebook." },
              { role: "user", content: prompt }
            ]
          },
          {
            headers: { Authorization: `Bearer ${API_TOKEN}` }
          }
        );

        const reply = response.data.result.response;
        api.sendMessage(reply, event.threadID, event.messageID);
      } catch (e) {
        console.error("Lỗi Cloudflare AI:", e);
        api.sendMessage("Sevzia đây nè! Bạn cần mình giúp gì đó?", event.threadID, event.messageID);
      }
    }
  },

  run: async function({ api, event }) {
    api.sendMessage("Gõ 'sevzia ơi [nội dung]' để trò chuyện với mình nhé!", event.threadID, event.messageID);
  }
};