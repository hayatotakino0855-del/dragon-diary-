const ytdl = require('ytdl-core');
const fs = require('fs');

const url = 'https://youtu.be/2BsBAQnFIVg';
const output = 'assets/ui/achievement_se.webm';

console.log('Downloading audio...');
ytdl(url, { filter: 'audioonly' })
  .pipe(fs.createWriteStream(output))
  .on('finish', () => {
    console.log('Download complete!');
  })
  .on('error', (err) => {
    console.error('Error:', err);
  });
