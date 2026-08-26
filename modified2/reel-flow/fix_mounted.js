const fs = require('fs');
const files = [
  '/home/unknown/Desktop/mobile_X/modified2/reel-flow/src/screens/RewardsScreen.tsx',
  '/home/unknown/Desktop/mobile_X/modified2/reel-flow/src/screens/WalletScreen.tsx',
  '/home/unknown/Desktop/mobile_X/modified2/reel-flow/src/screens/DailyMissionsScreen.tsx',
  '/home/unknown/Desktop/mobile_X/modified2/reel-flow/src/components/shorts/ShortsFeed.tsx',
  '/home/unknown/Desktop/mobile_X/modified2/reel-flow/src/components/ui/RouletteWheel.tsx'
];

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, 'utf8');
  if (!content.includes('mountedRef = useRef(true)')) {
    // Add mountedRef if possible
    content = content.replace(/const \[([a-zA-Z]+)\] = useState/i, 'const mountedRef = useRef(true);\n  useEffect(() => () => { mountedRef.current = false; }, []);\n  const [$1] = useState');
    // We also need to import useRef if missing, but it's usually there with useState
    if (!content.includes('useRef')) {
      content = content.replace('useState', 'useState, useRef');
    }
    
    // Replace state setters in finally blocks
    // e.g. setBusyTaskId(null); -> if (mountedRef.current) setBusyTaskId(null);
    const settersToWrap = ['setBusyTaskId', 'setSubmitting', 'setLoading', 'setSpinning', 'setRefreshing'];
    
    settersToWrap.forEach(setter => {
      const regex = new RegExp(`(?<!if \\(mountedRef\\.current\\) )\\b${setter}\\(`, 'g');
      content = content.replace(regex, `if (mountedRef.current) ${setter}(`);
    });
    
    fs.writeFileSync(f, content);
    console.log('Fixed', f);
  }
});
