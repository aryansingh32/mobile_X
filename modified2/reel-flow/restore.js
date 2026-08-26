const fs = require('fs');
const logContent = fs.readFileSync('/home/unknown/.gemini/antigravity/brain/d410bf12-db33-48d9-993e-f60164396e59/.system_generated/logs/transcript.jsonl', 'utf-8');
const lines = logContent.split('\n');

function findLastView(fileName) {
  let latestContent = null;
  for (const line of lines) {
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.source === 'SYSTEM' && obj.type === 'TOOL_RESPONSE' && obj.content) {
        if (obj.content.includes(`File Path: \`file:///home/unknown/Desktop/mobile_X/modified2/reel-flow/src/screens/${fileName}\``) || obj.content.includes(`File Path: \`file:///home/unknown/Desktop/mobile_X/modified2/reel-flow/src/api/${fileName}\``)) {
          const startStr = "The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.\n";
          let linesArr = obj.content.split('\n');
          let startIndex = linesArr.findIndex(l => l === "The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.");
          let endIndex1 = linesArr.findIndex(l => l === "The above content shows the entire, complete file contents of the requested file.");
          let endIndex2 = linesArr.findIndex(l => l === "The above content shows a portion of the requested file");
          
          let endIndex = endIndex1 !== -1 ? endIndex1 : endIndex2;
          
          if (startIndex !== -1 && endIndex !== -1) {
            let extracted = linesArr.slice(startIndex + 1, endIndex);
            let cleaned = extracted.map(l => {
              const match = l.match(/^\d+:\s?(.*)$/);
              return match ? match[1] : l;
            }).join('\n');
            latestContent = cleaned;
          }
        }
      }
    } catch (e) {}
  }
  return latestContent;
}

['AuthScreen.tsx', 'HomeScreen.tsx'].forEach(f => {
  const content = findLastView(f);
  if (content) {
    fs.writeFileSync(`src/screens/${f}`, content);
    console.log(`Restored ${f}`);
  }
});

const shortsContent = findLastView('shorts.ts');
if (shortsContent) {
  fs.writeFileSync('src/api/shorts.ts', shortsContent);
  console.log('Restored shorts.ts');
}
