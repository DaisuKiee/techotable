const OpenAI = require('openai');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Test OpenAI API key
 */
async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ No OpenAI API key found in .env file');
    return;
  }

  console.log('\n' + '═'.repeat(80));
  console.log('🤖 TESTING OPENAI API');
  console.log('═'.repeat(80) + '\n');
  console.log(`📍 API Key: ${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 4)}\n`);

  try {
    const openai = new OpenAI({ apiKey });
    
    console.log('🔄 Sending test message to GPT-3.5-turbo...\n');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant for a faculty timetabling system.',
        },
        {
          role: 'user',
          content: 'Hello! Can you help me with scheduling?',
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    const text = response.choices[0]?.message?.content || '';
    
    console.log('✅ SUCCESS!\n');
    console.log('─'.repeat(80));
    console.log('Response:');
    console.log(text);
    console.log('─'.repeat(80));
    console.log('\nModel:', response.model);
    console.log('Tokens used:', response.usage?.total_tokens || 'N/A');
    console.log('\n' + '═'.repeat(80));
    console.log('✅ OpenAI API is working correctly!');
    console.log('You can now use the AI chat feature in your application.');
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Error testing OpenAI API:');
    console.error(`   ${error.message}\n`);
    
    if (error.message.includes('401') || error.message.includes('invalid_api_key')) {
      console.log('💡 TIP: Your API key is invalid. Get a new one at:');
      console.log('   https://platform.openai.com/api-keys\n');
    } else if (error.message.includes('429') || error.message.includes('quota')) {
      console.log('💡 TIP: You\'ve exceeded your quota or rate limit.');
      console.log('   Check your usage at: https://platform.openai.com/usage\n');
    } else if (error.message.includes('model_not_found')) {
      console.log('💡 TIP: The model gpt-3.5-turbo is not available.');
      console.log('   Try using gpt-4 or check your API access.\n');
    }
    
    console.log('═'.repeat(80) + '\n');
  }
}

// Run the test
testOpenAI().catch(console.error);
