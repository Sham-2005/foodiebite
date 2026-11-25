const fs = require('fs');
const readline = require('readline');

async function searchRecent() {
  const fileStream = fs.createReadStream('C:/Users/LENOVO/.gemini/antigravity/brain/52c87ac3-8dba-4662-98c6-b1cdbc9c21db/.system_generated/logs/transcript.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (lineNum > 17500) {
      if (line.includes('USER_REQUEST') || line.includes('report') && (line.includes('user') || line.includes('kani') || line.includes('sham'))) {
        try {
          const parsed = JSON.parse(line);
          const snippet = typeof parsed.content === 'string' ? parsed.content.substring(0, 300) : '';
          console.log(`[L${lineNum}] ${parsed.type || parsed.source}: ${snippet.replace(/\n/g, ' ')}`);
        } catch (_) {}
      }
    }
  }
}

searchRecent().catch(console.error);
