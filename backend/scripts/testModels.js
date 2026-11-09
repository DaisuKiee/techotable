const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Test which Gemini models work with your API key
 */
async function testModels() {
  const apiKey = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ No Gemini API key found in .env file');
    return;
  }

  console.log('\n' + '═'.repeat(80));
  console.log('🧪 TESTING GEMINI MODELS');
  console.log('═'.repeat(80) + '\n');
  console.log(`📍 API Key: ${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 4)}\n`);

  // Models to test (from official Gemini API docs - current generation)
  const modelsToTest = [
    'gemini-2.5-flash',           // Recommended: Best price-performance
    'gemini-2.5-flash-lite',      // Fastest & most budget-friendly
    'gemini-2.5-pro',             // Most advanced for complex tasks
    'gemini-3.5-flash',           // New generation Flash
    'gemini-3.6-flash',           // Previous-gen Flash
    'gemini-3.7-flash',           // Latest Flash model
  ];

  const workingModels = [];
  const failedModels = [];

  console.log('Testing models (this may take a moment)...\n');
  console.log('─'.repeat(80) + '\n');

  for (const modelName of modelsToTest) {
    try {
      console.log(`🔄 Testing: ${modelName}...`);
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      // Try to generate content
      const result = await model.generateContent('Hello, respond with just "OK"');
      const response = await result.response;
      const text = response.text();
      
      console.log(`   ✅ SUCCESS - Response: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
      workingModels.push({
        name: modelName,
        response: text.substring(0, 100),
      });
      
    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      console.log(`   ❌ FAILED - ${errorMsg.substring(0, 100)}${errorMsg.length > 100 ? '...' : ''}`);
      failedModels.push({
        name: modelName,
        error: errorMsg,
      });
    }
    
    console.log('');
  }

  console.log('═'.repeat(80));
  console.log('\n📊 RESULTS:\n');
  
  if (workingModels.length > 0) {
    console.log(`✅ ${workingModels.length} WORKING MODEL(S):\n`);
    workingModels.forEach((m, i) => {
      console.log(`${i + 1}. 🟢 ${m.name}`);
      console.log(`   Response: "${m.response}"\n`);
    });
    
    console.log('─'.repeat(80));
    console.log('\n🎯 RECOMMENDATION:\n');
    console.log(`Use this model in gemini.service.js:`);
    console.log(`\n   model: '${workingModels[0].name}'\n`);
  } else {
    console.log('❌ NO WORKING MODELS FOUND\n');
    console.log('💡 Possible issues:');
    console.log('   1. API key is invalid or expired');
    console.log('   2. API key doesn\'t have access to these models');
    console.log('   3. You need to enable the Gemini API in Google Cloud Console');
    console.log('   4. Rate limit or quota exceeded\n');
    console.log('🔗 Get a new API key at: https://aistudio.google.com/app/apikey\n');
  }

  if (failedModels.length > 0) {
    console.log('─'.repeat(80));
    console.log(`\n❌ ${failedModels.length} FAILED MODEL(S):\n`);
    failedModels.forEach((m, i) => {
      console.log(`${i + 1}. 🔴 ${m.name}`);
      console.log(`   Error: ${m.error.substring(0, 150)}${m.error.length > 150 ? '...' : ''}\n`);
    });
  }

  console.log('═'.repeat(80) + '\n');
}

// Run the test
testModels().catch(console.error);
