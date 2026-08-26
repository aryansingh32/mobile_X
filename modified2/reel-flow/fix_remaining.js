const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'src/screens');
const componentsDir = path.join(__dirname, 'src/components');

function fixFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // 1. Fix RewardsScreen & WalletScreen: missing `mountedRef` in component body but present in `finally` blocks
    if (content.includes('mountedRef.current') && !content.includes('const mountedRef')) {
        const match = content.match(/export\s+(const\s+[A-Za-z0-9_]+\s*=\s*\([^)]*\)\s*=>\s*\{|function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)/);
        if (match) {
            const insertIndex = match.index + match[0].length;
            const refHook = `\n  const mountedRef = React.useRef(true);\n  React.useEffect(() => { return () => { mountedRef.current = false; } }, []);\n`;
            content = content.slice(0, insertIndex) + refHook + content.slice(insertIndex);
            if (!content.includes("import React")) {
                content = "import React from 'react';\n" + content;
            }
            changed = true;
        }
    }

    // 2. Fix RewardsScreen & WalletScreen missing `insets` definition
    if (content.includes('insets.top') && !content.includes('const insets = useSafeAreaInsets()')) {
        const match = content.match(/export\s+(const\s+[A-Za-z0-9_]+\s*=\s*\([^)]*\)\s*=>\s*\{|function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)/);
        if (match) {
            const insertIndex = match.index + match[0].length;
            content = content.slice(0, insertIndex) + '\n  const insets = useSafeAreaInsets();\n' + content.slice(insertIndex);
            if (!content.includes('useSafeAreaInsets')) {
                content = "import { useSafeAreaInsets } from 'react-native-safe-area-context';\n" + content;
            }
            changed = true;
        }
    }
    
    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed:', filePath);
    }
}

function walk(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            fixFile(fullPath);
        }
    });
}

walk(screensDir);
walk(componentsDir);
