'use strict';

const ollamaService = require('../src/services/ollamaService');

async function main() {
  console.log('====================================================');
  console.log('  FOODIEBITE LOCAL OLLAMA AI VERIFICATION & RUNNER  ');
  console.log('====================================================');

  console.log('1. Checking Ollama connection and model availability...');
  const status = await ollamaService.checkConnection(5000);
  console.log('   Status:', status.status);
  console.log('   Host:', status.host);
  console.log('   Model:', status.selectedModel);
  console.log('   Installed Models:', status.modelNames.join(', '));

  if (!status.connected) {
    console.error('❌ Could not connect to local Ollama. Ensure Ollama is running.');
    process.exit(1);
  }

  console.log('\n2. Testing live inference with FoodieBite Nutrition AI...');
  const prompt = 'What are 3 quick, diabetes-friendly breakfast foods with low glycemic index? Answer in 3 short bullet points.';
  console.log(`   User Prompt: "${prompt}"`);
  
  const startTime = Date.now();
  const res = await ollamaService.chat({
    system: 'You are FoodieBite AI, a clinical nutrition assistant. Provide concise, accurate dietary advice.',
    messages: [
      { role: 'user', content: prompt }
    ],
    options: {
      temperature: 0.3,
      num_predict: 150
    }
  });
  const duration = Date.now() - startTime;

  console.log('\n3. Inference Response Received:');
  console.log('────────────────────────────────────────────────────');
  console.log(res.reply);
  console.log('────────────────────────────────────────────────────');
  console.log(`\n4. Performance Metrics:`);
  console.log(`   • Model:              ${res.model}`);
  console.log(`   • Service Latency:    ${res.latencyMs} ms`);
  console.log(`   • End-to-End Time:    ${duration} ms`);
  console.log(`   • Tokens Generated:   ${res.evalCount || 'N/A'}`);
  console.log(`   • Source:             ${res.source}`);
  console.log('\n✅ Local Ollama AI is active, running, and responding successfully!\n');
}

main().catch(err => {
  console.error('❌ Error running Ollama AI:', err);
  process.exit(1);
});
