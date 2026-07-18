const fs = require('fs');
const path = require('path');

// Fix shortsController.ts TS errors
const shortsCtrlPath = path.join(__dirname, 'backend/src/controllers/shortsController.ts');
let shortsContent = fs.readFileSync(shortsCtrlPath, 'utf8');

// fix crypto.randomInt (Node crypto module needs to be imported properly or we can just use Math.random with a comment, but the agent wants crypto.
// crypto.randomInt is available in 'crypto'. Let's ensure it's imported correctly.
if (!shortsContent.includes('const crypto = require("crypto");') && !shortsContent.includes('import crypto from "crypto";') && !shortsContent.includes("import * as crypto from 'crypto';") && !shortsContent.includes("import crypto from 'crypto';")) {
   shortsContent = "import crypto from 'crypto';\n" + shortsContent;
}

// Fix undefined in orderBy
shortsContent = shortsContent.replace(
    /orderBy: mode === 'TOP10' \? \{ addedAt: 'desc' \} : undefined,/g,
    "orderBy: mode === 'TOP10' ? { addedAt: 'desc' } : {}," // prisma accepts empty object, or we conditionally spread
);
shortsContent = shortsContent.replace(
    /orderBy: mode === 'TOP10' \? \{ addedAt: 'desc' \} : undefined/g,
    "orderBy: mode === 'TOP10' ? { addedAt: 'desc' } as any : undefined"
);

fs.writeFileSync(shortsCtrlPath, shortsContent);
console.log('Fixed shortsController.ts types');

// Fix rewardsController.ts TS errors
const rewardsCtrlPath = path.join(__dirname, 'backend/src/controllers/rewardsController.ts');
let rewardsContent = fs.readFileSync(rewardsCtrlPath, 'utf8');
// parseInt(uStr) where uStr might be undefined
rewardsContent = rewardsContent.replace(
    /const uid = parseInt\(uStr\);/g,
    "const uid = parseInt(uStr || '0');"
);
fs.writeFileSync(rewardsCtrlPath, rewardsContent);
console.log('Fixed rewardsController.ts types');

