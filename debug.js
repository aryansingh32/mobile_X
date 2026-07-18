const fs = require('fs');
const logContent = fs.readFileSync('/home/unknown/.gemini/antigravity/brain/d410bf12-db33-48d9-993e-f60164396e59/.system_generated/logs/transcript.jsonl', 'utf-8');
const lines = logContent.split('\n');

for (const line of lines) {
  if (!line) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.source === 'SYSTEM' && obj.type === 'TOOL_RESPONSE' && obj.content) {
      if (obj.content.includes(`AuthScreen.tsx`)) {
        console.log("FOUND AUTHRSCREN IN TOOL RESPONSE!");
        console.log(obj.content.substring(0, 300));
        break;
      }
    }
  } catch (e) {}
}
