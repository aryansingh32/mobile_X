const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, 'src/store/useAppStore.ts');
let storeContent = fs.readFileSync(storePath, 'utf8');

// If AppState interface exists, export it
if (storeContent.includes('interface AppState') && !storeContent.includes('export interface AppState')) {
    storeContent = storeContent.replace('interface AppState', 'export interface AppState');
    fs.writeFileSync(storePath, storeContent);
    console.log('Fixed useAppStore.ts (exported AppState)');
}

const screensDir = path.join(__dirname, 'src/screens');
const componentsDir = path.join(__dirname, 'src/components');
const hooksDir = path.join(__dirname, 'src/hooks');

function fixFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Use proper typing for useShallow
    if (content.includes('useShallow((s: any) =>')) {
        content = content.replace(/useShallow\(\(s: any\) =>/g, 'useShallow((s: AppState) =>');
        
        // Add import for AppState if needed
        if (!content.includes('AppState') && content.includes('useAppStore')) {
             // Find useAppStore import and append AppState
             const importRegex = /import\s+\{([^}]+useAppStore[^}]+)\}\s+from\s+['"]([^'"]+useAppStore)['"]/;
             const match = content.match(importRegex);
             if (match) {
                 if (!match[1].includes('AppState')) {
                     const newImport = match[0].replace('useAppStore', 'useAppStore, AppState');
                     content = content.replace(match[0], newImport);
                 }
             } else {
                 content = "import { AppState } from '../store/useAppStore';\n" + content; // Fallback
             }
        }
        changed = true;
    }

    if (filePath.includes('RewardsScreen.tsx') && content.includes('insets = useSafeAreaInsets()') && !content.includes("import { useSafeAreaInsets }")) {
         content = "import { useSafeAreaInsets } from 'react-native-safe-area-context';\n" + content;
         changed = true;
    }

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed AppState in:', filePath);
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

// App.tsx check
fixFile(path.join(__dirname, 'App.tsx'));
