// api/bridge.js - Secure Serverless Bridge with Gemini 3.8 Flash
let pendingCode = null;
let lastPrompt = "";
let promptCount = 0;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Website sends prompt -> Backend calls Gemini 3.8 Flash securely -> Queues code for Studio
  if (req.method === 'POST') {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set in Vercel Environment Variables.' });
    }
    if (!prompt) {
      return res.status(400).json({ error: 'No prompt provided.' });
    }

    try {
      // Updated to gemini-3.8-flash model endpoint as required
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are an expert Roblox Studio Luau developer. Write a single, complete, runnable Luau script that builds and parents everything directly into Workspace, ServerScriptService, or StarterGui as needed for this request: "${prompt}". For UI, always add UICorner, UIStroke, and UIScale. Return ONLY the Luau code inside \`\`\`lua ... \`\`\` tags.`
            }]
          }]
        })
      });

      const data = await geminiRes.json();
      if (!data.candidates || !data.candidates[0]) {
        return res.status(500).json({ error: data.error?.message || 'Failed to generate from Gemini.' });
      }

      const rawText = data.candidates[0].content.parts[0].text;
      const codeMatch = rawText.match(/```lua([\s\S]*?)```/) || rawText.match(/```([\s\S]*?)```/);
      const cleanCode = codeMatch ? codeMatch[1].trim() : rawText.trim();

      pendingCode = cleanCode;
      lastPrompt = prompt;
      promptCount++;

      return res.status(200).json({
        status: 'Queued for Studio',
        code: cleanCode,
        promptCount
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 2. Roblox Studio Plugin polls this every 2 seconds
  if (req.method === 'GET') {
    if (pendingCode) {
      const codeToSend = pendingCode;
      pendingCode = null;
      return res.status(200).json({
        hasWork: true,
        code: codeToSend,
        prompt: lastPrompt,
        promptCount
      });
    }
    return res.status(200).json({
      hasWork: false,
      promptCount
    });
  }
}