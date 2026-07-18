const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const tempDir = path.join(__dirname, 'temp_frames');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  console.log('Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set viewport large enough for the hardcoded 512px pyramid
  await page.setViewport({
    width: 512,
    height: 512,
    deviceScaleFactor: 1, // We will downscale later anyway
  });

  const fileUrl = 'file://' + path.join(__dirname, 'index.html');
  console.log('Loading page:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  // Prepare the page for manual frame-by-frame rendering
  await page.evaluate(() => {
    // Remove background color to allow omitBackground to work properly
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    
    // Stop the CSS animation and take over manually
    const wrapper = document.querySelector('.wrapper');
    wrapper.style.animation = 'none';
  });

  const numFrames = 120;
  console.log(`Capturing ${numFrames} frames...`);
  
  for (let i = 0; i < numFrames; i++) {
    const degrees = (360 / numFrames) * i;
    
    await page.evaluate((deg) => {
      document.querySelector('.wrapper').style.transform = `rotateY(${deg}deg)`;
    }, degrees);
    
    const frameNumber = String(i).padStart(3, '0');
    const framePath = path.join(tempDir, `frame_${frameNumber}.png`);
    
    await page.screenshot({
      path: framePath,
      omitBackground: true,
      type: 'png'
    });
    
    if ((i + 1) % 10 === 0) {
      console.log(`Captured ${i + 1}/${numFrames} frames`);
    }
  }

  await browser.close();
  console.log('Puppeteer capture complete.');
})();
