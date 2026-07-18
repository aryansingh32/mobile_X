const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

(async () => {
  const tempDir = path.join(__dirname, 'temp_frames');
  const tempScaledDir = path.join(__dirname, 'temp_scaled_frames');
  
  // Cleanup previous runs
  [tempDir, tempScaledDir].forEach(dir => {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  });

  console.log('Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // We capture at 512x512 to ensure high fidelity before downscaling
  await page.setViewport({
    width: 512,
    height: 512,
    deviceScaleFactor: 1, 
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
  console.log(`Capturing ${numFrames} frames natively...`);
  
  for (let i = 0; i < numFrames; i++) {
    const degrees = (360 / numFrames) * i;
    
    await page.evaluate((deg) => {
      document.querySelector('.wrapper').style.transform = `rotateY(${deg}deg)`;
    }, degrees);
    
    const frameNumber = String(i).padStart(3, '0');
    const framePath = path.join(tempDir, `frame_${frameNumber}.png`);
    
    await page.screenshot({
      path: framePath,
      omitBackground: true, // Native 8-bit alpha
      type: 'png'
    });
    
    if ((i + 1) % 20 === 0) {
      console.log(`Captured ${i + 1}/${numFrames} frames`);
    }
  }

  await browser.close();
  console.log('Puppeteer capture complete.');

  // Scale down the frames to eliminate LAG
  // The original 1024x1024 resulted in an 18MB WebP file which chokes React Native.
  // We scale to 128x128 (still >5x retina scale for 24x24) to keep it lightweight.
  console.log('Optimizing & scaling frames to eliminate lag...');
  try {
    execSync(`ffmpeg -y -i "${path.join(tempDir, 'frame_%03d.png')}" -vf "scale=128:128:flags=lanczos" "${path.join(tempScaledDir, 'frame_%03d.png')}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('Error scaling frames with FFmpeg:', err);
  }

  const outputFile = path.join(__dirname, 'pyramid_loader.webp');
  if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);

  console.log('Running img2webp to compile animation and fix TRAILS...');
  // Note: FFmpeg's libwebp encoder notoriously defaults to alpha-blending for animations, 
  // which leaves trailing ghost artifacts. We use Google's official img2webp to properly 
  // dispose transparent frames.
  const img2webpPath = path.join(__dirname, 'libwebp-1.3.2-linux-x86-64', 'bin', 'img2webp');
  try {
    // Generate the file with img2webp
    const webpCommand = `"${img2webpPath}" -lossless -d 33 -loop 0 "${tempScaledDir}"/frame_*.png -o "${outputFile}"`;
    console.log(`Executing: ${webpCommand}`);
    execSync(webpCommand, { stdio: 'inherit' });
    console.log('WebP generation complete.');
  } catch (err) {
    console.error('Error running img2webp:', err);
  } finally {
    console.log('Cleaning up temporary directories...');
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(tempScaledDir, { recursive: true, force: true });
  }

  console.log('Done! Asset created at:', outputFile);
})();
