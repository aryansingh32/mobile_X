const fs = require('fs');
const glob = require('glob');

const files = glob.sync('/home/unknown/Desktop/mobile_X/modified2/reel-flow/src/**/*.{ts,tsx}');
let totalChanged = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Find patterns like: const { a, b, c } = useAppStore(useShallow((s: AppState) => ({ a, b, c })));
  // We need to match the destructured variables and the object inside the arrow function.
  // Actually, we can just look for useShallow((s: AppState) => ({ ... })) or similar.
  
  const regex = /useShallow\(\s*\(\s*s[^)]*\)\s*=>\s*\(\{\s*([^}]+)\s*\}\)\s*\)/g;
  
  let modified = false;
  let newContent = content.replace(regex, (match, p1) => {
    // p1 contains the keys, e.g., "isAdPlaying, setAdPlaying, canWatchAd"
    // Also there might be newlines, so we need to handle that.
    const keys = p1.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    // Some keys might already be correctly mapped, like "games: s.games". Let's preserve them or fix them.
    const mapped = keys.map(k => {
      if (k.includes(':')) return k; // already mapped, keep it
      return `${k}: s.${k}`;
    });
    
    modified = true;
    return `useShallow((s: AppState) => ({ ${mapped.join(', ')} }))`;
  });
  
  if (modified) {
    fs.writeFileSync(file, newContent);
    console.log(`Updated ${file}`);
    totalChanged++;
  }
});

console.log(`Total files fixed: ${totalChanged}`);
