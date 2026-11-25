const ollamaService = require('../src/services/ollamaService');

async function checkOllama() {
  console.log('Testing Ollama connection...');
  const status = await ollamaService.checkConnection(5000);
  console.log('Ollama status:', status);
}

checkOllama().catch(console.error);
