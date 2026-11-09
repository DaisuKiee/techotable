/**
 * Interactive script to update Gemini API keys in .env file
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const envPath = path.join(__dirname, '..', '.env');

console.log('\n' + '═'.repeat(80));
console.log('🔑 GEMINI API KEY UPDATER');
console.log('═'.repeat(80) + '\n');
console.log('This script will help you update your Gemini API keys in the .env file.\n');
console.log('📋 Instructions:');
console.log('1. Get your API keys from: https://aistudio.google.com/app/apikey');
console.log('2. Paste each key when prompted');
console.log('3. Press Enter after each key\n');
console.log('─'.repeat(80) + '\n');

const keys = [];

function askForKey(number) {
  return new Promise((resolve) => {
    rl.question(`Enter API Key ${number}/5: `, (answer) => {
      const trimmedKey = answer.trim();
      if (trimmedKey) {
        keys.push(trimmedKey);
        console.log(`  ✓ Key ${number} saved (${trimmedKey.substring(0, 10)}...)\n`);
      } else {
        console.log(`  ⚠️  Key ${number} skipped (empty)\n`);
      }
      resolve();
    });
  });
}

async function main() {
  try {
    // Collect all 5 keys
    for (let i = 1; i <= 5; i++) {
      await askForKey(i);
    }

    rl.close();

    if (keys.length === 0) {
      console.log('\n❌ No keys provided. Exiting without changes.\n');
      return;
    }

    console.log('─'.repeat(80));
    console.log(`\n📝 Updating .env file with ${keys.length} key(s)...\n`);

    // Read current .env file
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Update each key
    for (let i = 0; i < 5; i++) {
      const keyName = `GEMINI_API_KEY_${i + 1}`;
      const keyValue = keys[i] || ''; // Use empty string if key not provided
      
      const regex = new RegExp(`${keyName}=.*`, 'g');
      
      if (envContent.match(regex)) {
        // Replace existing key
        envContent = envContent.replace(regex, `${keyName}=${keyValue}`);
        console.log(`  ✓ Updated ${keyName}`);
      } else {
        // Add new key if not exists
        envContent += `\n${keyName}=${keyValue}`;
        console.log(`  ✓ Added ${keyName}`);
      }
    }

    // Write back to .env
    fs.writeFileSync(envPath, envContent, 'utf8');

    console.log('\n✅ Successfully updated .env file!\n');
    console.log('─'.repeat(80));
    console.log('\n📋 Next Steps:\n');
    console.log('1. Run: node scripts/testModels.js');
    console.log('   → This will test if your keys work\n');
    console.log('2. Restart your backend server');
    console.log('   → Press Ctrl+C and run: npm start\n');
    console.log('3. Test the AI chat in your application\n');
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Error updating .env file:', error.message);
    console.log('\nPlease update the keys manually in backend/.env\n');
  }
}

main();
