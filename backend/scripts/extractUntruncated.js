const fs = require('fs');
const readline = require('readline');

async function extractFullRequest() {
  const fileStream = fs.createReadStream('C:/Users/LENOVO/.gemini/antigravity/brain/52c87ac3-8dba-4662-98c6-b1cdbc9c21db/.system_generated/logs/transcript_full.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (lineNum === 17653) {
      const parsed = JSON.parse(line);
      fs.writeFileSync('s:/files/food_app/backend/scripts/user_request_untruncated.md', parsed.content, 'utf8');
      console.log('Saved untruncated user request, length:', parsed.content.length);
      break;
    }
  }
}

extractFullRequest().catch(console.error);
