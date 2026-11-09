const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * List all available Gemini models for your API key
 */
async function listAvailableModels() {
  const apiKey = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ No Gemini API key found in .env file');
    console.log('Please add GEMINI_API_KEY_1 or GEMINI_API_KEY to your .env file');
    return;
  }

  console.log('\n' + '═'.repeat(80));
  console.log('🤖 GEMINI API - AVAILABLE MODELS');
  console.log('═'.repeat(80) + '\n');
  console.log(`📍 API Key: ${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log(`📦 SDK Version: @google/generative-ai v0.24.1\n`);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    console.log('🔍 Fetching available models...\n');
    
    // List all models
    const models = await genAI.listModels();
    
    if (!models || models.length === 0) {
      console.log('⚠️  No models found or API key has no access');
      return;
    }

    console.log(`✅ Found ${models.length} available model(s):\n`);
    console.log('─'.repeat(80));

    // Free tier models (typically available with free API keys)
    const freeModels = [];
    const proModels = [];

    models.forEach((model, index) => {
      const modelName = model.name.replace('models/', '');
      const supportedMethods = model.supportedGenerationMethods || [];
      const inputTokenLimit = model.inputTokenLimit || 'N/A';
      const outputTokenLimit = model.outputTokenLimit || 'N/A';
      
      console.log(`\n${index + 1}. 📋 MODEL: ${modelName}`);
      console.log(`   ├─ Full Path: ${model.name}`);
      console.log(`   ├─ Display Name: ${model.displayName || 'N/A'}`);
      console.log(`   ├─ Description: ${model.description || 'N/A'}`);
      console.log(`   ├─ Supported Methods: ${supportedMethods.join(', ') || 'None'}`);
      console.log(`   ├─ Input Token Limit: ${inputTokenLimit}`);
      console.log(`   ├─ Output Token Limit: ${outputTokenLimit}`);
      console.log(`   └─ Temperature: ${model.temperature || 'Default'}`);

      // Categorize models
      if (modelName.includes('pro') && !modelName.includes('gemini-pro')) {
        proModels.push(modelName);
      } else {
        freeModels.push(modelName);
      }
    });

    console.log('\n' + '─'.repeat(80));
    console.log('\n📊 SUMMARY:\n');
    console.log(`🆓 Free Tier Models (typically): ${freeModels.length > 0 ? freeModels.join(', ') : 'None'}`);
    console.log(`💎 Pro/Advanced Models: ${proModels.length > 0 ? proModels.join(', ') : 'None'}`);

    console.log('\n' + '─'.repeat(80));
    console.log('\n💡 RECOMMENDATIONS FOR YOUR USE CASE (RAG + Chat):\n');
    
    // Find the best model for chat
    const chatModels = models.filter(m => 
      (m.supportedGenerationMethods || []).includes('generateContent')
    );

    if (chatModels.length > 0) {
      console.log('✅ Models that support chat (generateContent):');
      chatModels.forEach(m => {
        const name = m.name.replace('models/', '');
        console.log(`   • ${name}`);
      });
      
      console.log('\n🎯 BEST CHOICE FOR YOUR APP:');
      const recommended = chatModels[0].name.replace('models/', '');
      console.log(`   Use: "${recommended}"\n`);
      console.log(`   Update in gemini.service.js line ~190:`);
      console.log(`   model: '${recommended}'`);
    } else {
      console.log('⚠️  No models support chat functionality');
    }

    console.log('\n' + '═'.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Error fetching models:');
    console.error(`   ${error.message}\n`);
    
    if (error.message.includes('API key')) {
      console.log('💡 TIP: Check that your API key is valid at:');
      console.log('   https://aistudio.google.com/app/apikey\n');
    }
    
    if (error.message.includes('403') || error.message.includes('401')) {
      console.log('💡 TIP: Your API key might not have permission to list models.');
      console.log('   Try using "gemini-pro" directly - it\'s the standard free model.\n');
    }
  }
}

// Run the script
listAvailableModels().catch(console.error);
