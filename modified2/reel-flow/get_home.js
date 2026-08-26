const fs = require('fs');
const logContent = fs.readFileSync('/home/unknown/.gemini/antigravity/brain/d410bf12-db33-48d9-993e-f60164396e59/.system_generated/logs/transcript.jsonl', 'utf-8');
const lines = logContent.split('\n');

for (const line of lines) {
  if (!line) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.content && obj.content.includes(`File Path: \`file:///home/unknown/Desktop/mobile_X/modified2/reel-flow/src/screens/HomeScreen.tsx\``)) {
      if (obj.content.includes("stats strip")) {
        fs.writeFileSync('home_from_log.txt', obj.content);
        console.log("Found log with stats strip!");
        break;
      }
    }
  } catch (e) {}
}
