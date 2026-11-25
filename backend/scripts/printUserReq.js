const fs = require('fs');
const readline = require('readline');

async function printUserRequest() {
  const fileStream = fs.createReadStream('C:/Users/LENOVO/.gemini/antigravity/brain/52c87ac3-8dba-4662-98c6-b1cdbc9c21db/.system_generated/logs/transcript.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (lineNum === 17653) {
      const parsed = JSON.parse(line);
      console.log('User Request:\n', parsed.content);
      break;
    }
  }
}

printUserRequest().catch(console.error);
