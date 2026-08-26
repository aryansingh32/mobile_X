const fs = require('fs');
const glob = require('glob');

const files = glob.sync('/home/unknown/Desktop/mobile_X/modified2/reel-flow/src/**/*.{ts,tsx}');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Regex to find: const { ... } = useAppStore();
  // We need to handle multi-line destructuring as well.
  const regex = /const\s+({[^}]+})\s*=\s*useAppStore\(\);/g;
  
  let modified = false;
  let newContent = content.replace(regex, (match, p1) => {
    modified = true;
    return `const ${p1} = useAppStore(useShallow(s => (${p1})));`;
  });
  
  if (modified) {
    // Add import for useShallow if not present
    if (!newContent.includes('useShallow')) {
      newContent = `import { useShallow } from 'zustand/react/shallow';\n` + newContent;
    }
    fs.writeFileSync(file, newContent);
    console.log(`Updated ${file}`);
  }
});
