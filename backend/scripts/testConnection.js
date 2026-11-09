/**
 * MongoDB Connection Test Script
 * Run this to verify MongoDB Atlas connection
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const testConnection = async () => {
  console.log('🔍 Testing MongoDB Connection...\n');
  
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env file!');
    console.log('\n📁 Looking for .env in:', path.join(__dirname, '..', '.env'));
    process.exit(1);
  }
  
  console.log('Connection String:', process.env.MONGODB_URI.replace(/\/\/.*:.*@/, '//***:***@'));
  
  try {
    console.log('\n⏳ Connecting to MongoDB Atlas...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });
    
    console.log('✅ MongoDB Connected Successfully!\n');
    
    // Test a simple query
    console.log('📊 Testing database query...');
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`✅ Found ${collections.length} collections:`);
    collections.forEach(col => console.log(`   - ${col.name}`));
    
    // Count documents in users collection
    const User = mongoose.connection.collection('users');
    const userCount = await User.countDocuments();
    console.log(`\n👥 Total users in database: ${userCount}`);
    
    console.log('\n✅ All tests passed! MongoDB connection is working.\n');
    
  } catch (error) {
    console.error('\n❌ MongoDB Connection Failed!\n');
    console.error('Error:', error.message);
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.log('\n💡 DNS/Network issue - Check your internet connection');
    } else if (error.message.includes('authentication failed')) {
      console.log('\n💡 Authentication failed - Check username/password in connection string');
    } else if (error.message.includes('connect')) {
      console.log('\n💡 Connection timeout - Possible causes:');
      console.log('   1. Your IP address is not whitelisted in MongoDB Atlas');
      console.log('   2. Firewall blocking the connection');
      console.log('   3. VPN interfering with connection');
      console.log('\n🔧 Solution:');
      console.log('   1. Go to: https://cloud.mongodb.com');
      console.log('   2. Navigate to: Network Access');
      console.log('   3. Click: Add IP Address');
      console.log('   4. Add: 0.0.0.0/0 (allow all) for development');
    }
    
    console.log('\n');
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Connection closed.');
    process.exit(0);
  }
};

testConnection();
