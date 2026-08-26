const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'src/screens');
const componentsDir = path.join(__dirname, 'src/components');
const hooksDir = path.join(__dirname, 'src/hooks');

function fixFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // 1. Fix useShallow TS errors in useAppStore
    // TS complains if we don't have types for `s` or the return value. The easy fix is to just let the store return everything without useShallow for now to unblock compilation, or type it as `s: any`.
    // Actually, `useAppStore(useShallow(s => ({ ... })))` has an issue if `useAppStore` type inference fails. Let's cast `s` to `any`.
    if (content.includes('useShallow(s =>')) {
        content = content.replace(/useShallow\(s =>/g, 'useShallow((s: any) =>');
        changed = true;
    }

    // 2. Fix mountedRef missing
    if (content.includes('mountedRef.current')) {
        if (!content.includes('const mountedRef = React.useRef(true)') && !content.includes('const mountedRef = useRef(true)')) {
            // Find the component function declaration
            const componentRegex = /export\s+(default\s+)?function\s+([A-Z][a-zA-Z0-9_]*)\s*\([^)]*\)\s*\{/;
            const match = content.match(componentRegex);
            if (match) {
                const insertIndex = match.index + match[0].length;
                const refHook = `\n  const mountedRef = React.useRef(true);\n  React.useEffect(() => { return () => { mountedRef.current = false; } }, []);\n`;
                content = content.slice(0, insertIndex) + refHook + content.slice(insertIndex);
                
                // Make sure React is imported if we use React.useRef
                if (!content.includes("import React")) {
                    content = "import React from 'react';\n" + content;
                }
                changed = true;
            }
        }
    }

    // 3. Fix missing insets definition (specifically RewardsScreen, WalletScreen)
    if (content.includes('insets.top') && !content.includes('const insets = useSafeAreaInsets()')) {
        const componentRegex = /export\s+(default\s+)?function\s+([A-Z][a-zA-Z0-9_]*)\s*\([^)]*\)\s*\{/;
        const match = content.match(componentRegex);
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
        console.log('Fixed types in:', filePath);
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
walk(hooksDir);

// Also check App.tsx
fixFile(path.join(__dirname, 'App.tsx'));
