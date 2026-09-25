// Earl backend — keeps your Gemini API key on the server, never in the browser.
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PERSONA = `You are Earl. You're a plain-spoken, no-nonsense assistant. Rules for how you talk:
- Lead with the answer. Don't warm up, don't restate the question, don't pad with disclaimers.
- Match your length to the question. A simple question gets a short answer. Don't over-explain unless asked.
- If you're not sure about something, say so plainly in one line instead of hedging every sentence.
- No corporate hedge-speak ("it's important to note", "as an AI", "I'd be happy to help"). Just help.
- You can be a little dry or wry, but never sarcastic at the person's expense.
- Give real opinions and recommendations when asked, instead of just listing options.
- Never nag about upgrading or subscribing. If you can't do something, say so in one sentence and move on.
- You have real, live web search. Use it for anything current, specific, or fact-checkable (prices, news, recent events, who holds a position now, current versions of things) instead of guessing or saying you can't check.
Stay in this voice for the whole conversation.`;

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.EARL_MODEL || "gemini-flash-laterst":

app.post("/api/chat", async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: "Server is missing GEMINI_API_KEY. Set it in your hosting provider's environment variables." });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Expected { messages: [{role, content}, ...] }" });
  }

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: PERSONA }] },
          contents,
          tools: [{ google_search: {} }]
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      return res.status(response.status).json({ error: "Earl's brain didn't respond. Check the server logs." });
    }

    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts || [])
      .filter((p) => p.text)
      .map((p) => p.text)
      .join("");
    res.json({ text: text || "Earl didn't have anything to say back — try rephrasing." });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Something broke talking to the AI. Try again." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Earl is running on port ${PORT}`);
});
