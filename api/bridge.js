// api/bridge.js - Serverless Bridge between your Website and Roblox Studio
let pendingCode = null;
let lastPrompt = "";
let promptCount = 0;

export default function handler(req, res) {
  // Allow your website and Roblox Studio to talk to this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Website sends generated Luau code here
  if (req.method === 'POST') {
    const { code, prompt } = req.body;
    if (code) {
      pendingCode = code;
      lastPrompt = prompt || "Custom Build";
      promptCount++;
      return res.status(200).json({ status: 'Queued for Studio', promptCount });
    }
    return res.status(400).json({ error: 'No code provided' });
  }

  // 2. Roblox Studio Plugin checks here every 2 seconds
  if (req.method === 'GET') {
    if (pendingCode) {
      const codeToSend = pendingCode;
      pendingCode = null; // Clear after sending so it only runs once
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