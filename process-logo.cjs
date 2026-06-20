const Jimp = require('jimp');

async function processImage() {
  const image = await Jimp.read('public/logo.png');
  
  // Convert white background to transparent
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    
    // If pixel is very close to white, make it transparent
    if (r > 240 && g > 240 && b > 240) {
      this.bitmap.data[idx + 3] = 0; // Alpha
    }
  });
  
  await image.writeAsync('public/logo.png');
  console.log('Logo processed successfully');
}

processImage().catch(console.error);
