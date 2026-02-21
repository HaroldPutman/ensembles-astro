#!/usr/bin/env node

import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env file if it exists
dotenv.config();

async function testConnection() {
  const connectionString =
    process.env.DATABASE_URL || process.env.DATABASE_URL_PROD;

  if (!connectionString) {
    console.error(
      '❌ No DATABASE_URL or DATABASE_URL_PROD environment variable found'
    );
    console.log(
      '\nTo test your connection, set one of these environment variables:'
    );
    console.log(
      '  export DATABASE_URL="postgresql://username:password@host:port/database"'
    );
    console.log(
      '  export DATABASE_URL_PROD="postgresql://username:password@host:port/database"'
    );
    console.log('\nOr create a .env file with:');
    console.log(
      '  DATABASE_URL=postgresql://username:password@host:port/database'
    );
    process.exit(1);
  }

  console.log('🔍 Testing database connection...');
  console.log(
    `📍 Connection string: ${connectionString.replace(/:[^:@]+@/, ':***@')}`
  ); // Hide password

  const pool = new Pool({
    connectionString: connectionString,
  });

  try {
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Successfully connected to database!');

    // Test a simple query
    const result = await client.query(
      'SELECT NOW() as current_time, version() as db_version'
    );
    console.log('📊 Database info:');
    console.log(`   Current time: ${result.rows[0].current_time}`);
    console.log(
      `   Version: ${result.rows[0].db_version.split(' ')[0]} ${result.rows[0].db_version.split(' ')[1]}`
    );

    // Test if our tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    if (tablesResult.rows.length > 0) {
      console.log('📋 Existing tables:');
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('📋 No tables found in public schema');
    }

    client.release();
    console.log('🎉 Database connection test completed successfully!');
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(`   Error: ${error.message}`);

    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }

    // Provide helpful error messages
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 This usually means:');
      console.log('   - The database server is not running');
      console.log('   - Wrong host or port in connection string');
      console.log('   - Firewall blocking the connection');
    } else if (error.code === '28P01') {
      console.log('\n💡 This usually means:');
      console.log('   - Wrong username or password');
      console.log('   - User does not exist');
    } else if (error.code === '3D000') {
      console.log('\n💡 This usually means:');
      console.log('   - Database does not exist');
      console.log('   - Wrong database name in connection string');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();
