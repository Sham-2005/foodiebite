const fs = require('fs');
const readline = require('readline');

async function printFullUserRequest() {
  const fileStream = fs.createReadStream('C:/Users/LENOVO/.gemini/antigravity/brain/52c87ac3-8dba-4662-98c6-b1cdbc9c21db/.system_generated/logs/transcript.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (lineNum === 17653) {
      const parsed = JSON.parse(line);
      fs.writeFileSync('s:/files/food_app/backend/scripts/full_user_request.md', parsed.content, 'utf8');
      console.log('Saved full user request to full_user_request.md, length:', parsed.content.length);
      break;
    }
  }
}

printFullUserRequest().catch(console.error);
