const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'src/screens');
const componentsDir = path.join(__dirname, 'src/components');

function fixFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // 1. Fix useShallow import
    if (content.includes('useShallow') && !content.includes('zustand/react/shallow')) {
        content = "import { useShallow } from 'zustand/react/shallow';\n" + content;
        changed = true;
    }

    // 2. Fix useSafeAreaInsets import
    if (content.includes('useSafeAreaInsets') && !content.includes('react-native-safe-area-context')) {
        content = "import { useSafeAreaInsets } from 'react-native-safe-area-context';\n" + content;
        changed = true;
    }
    
    // 2.b Fix missing insets definition in AuthScreen (where Math.max(insets.top, 60) is used)
    if (filePath.includes('AuthScreen.tsx') && content.includes('insets.top') && !content.includes('const insets =')) {
        content = content.replace('export function AuthScreen() {', 'export function AuthScreen() {\n  const insets = useSafeAreaInsets();');
        changed = true;
    }

    // 3. Fix mountedRef missing
    if (content.includes('mountedRef.current') && !content.includes('const mountedRef = useRef(true)')) {
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

    // 4. Fix TouchableOpacity in ShortsFeed
    if (filePath.includes('ShortsFeed.tsx') && content.includes('TouchableOpacity') && !content.includes('TouchableOpacity') /* this check is wrong, let's fix below */) {
        // Do regex replace for react-native imports
        const rnImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"]react-native['"];/;
        const rnMatch = content.match(rnImportRegex);
        if (rnMatch && !rnMatch[1].includes('TouchableOpacity')) {
            content = content.replace(rnImportRegex, `import { $1, TouchableOpacity } from 'react-native';`);
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed:', filePath);
    }
}

function walk(dir) {
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

// Also check App.tsx
fixFile(path.join(__dirname, 'App.tsx'));
