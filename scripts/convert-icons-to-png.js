import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const iconsDir = '/vercel/share/v0-project/public/icons';

// Get all JPG files in the icons directory
const jpgFiles = fs.readdirSync(iconsDir).filter(file => file.endsWith('.jpg'));

console.log(`Found ${jpgFiles.length} JPG files to convert`);

for (const jpgFile of jpgFiles) {
  const inputPath = path.join(iconsDir, jpgFile);
  const outputPath = path.join(iconsDir, jpgFile.replace('.jpg', '.png'));
  
  try {
    await sharp(inputPath)
      .png()
      .toFile(outputPath);
    
    console.log(`Converted: ${jpgFile} -> ${jpgFile.replace('.jpg', '.png')}`);
    
    // Remove the old JPG file
    fs.unlinkSync(inputPath);
    console.log(`Removed: ${jpgFile}`);
  } catch (error) {
    console.error(`Error converting ${jpgFile}:`, error.message);
  }
}

console.log('Done! All icons converted to PNG.');
