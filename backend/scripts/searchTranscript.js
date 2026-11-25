const fs = require('fs');
const readline = require('readline');

async function searchTranscript() {
  const fileStream = fs.createReadStream('C:/Users/LENOVO/.gemini/antigravity/brain/52c87ac3-8dba-4662-98c6-b1cdbc9c21db/.system_generated/logs/transcript.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (line.includes('Medical Scans') || line.includes('badge') || line.includes('1') && line.includes('report') && line.includes('Profile')) {
      // Print a snippet
      console.log(`Line ${lineNum}: ${line.substring(0, 200)}...`);
    }
  }
}

searchTranscript().catch(console.error);
