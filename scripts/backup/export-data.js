#!/usr/bin/env node

/**
 * Export data from Supabase to SQL file
 * This script uses Prisma to read data and generates SQL INSERT statements
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { PrismaClient } = require('../../packages/database');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL
    }
  }
});

const OUTPUT_DIR = path.join(__dirname, 'backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
const OUTPUT_FILE = path.join(OUTPUT_DIR, `supabase-data-${TIMESTAMP}.sql`);

// Tables to export in dependency order
const TABLES = [
  'Company',
  'Workspace',
  'User',
  'Pipeline',
  'Stage',
  'Lead',
  'AuditLog'
];

/**
 * Escape SQL string values
 */
function escapeSql(value) {
  if (value === null) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return value.toString();
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Generate INSERT statement for a record
 */
function generateInsert(tableName, record) {
  const columns = Object.keys(record);
  const values = Object.values(record);
  const columnsStr = columns.join(', ');
  const valuesStr = values.map(escapeSql).join(', ');

  return `INSERT INTO "${tableName}" (${columnsStr}) VALUES (${valuesStr});\n`;
}

/**
 * Export all data from a table
 */
async function exportTable(tableName) {
  try {
    // Use raw query to avoid Prisma client issues
    const records = await prisma.$queryRawUnsafe(`SELECT * FROM "${tableName}"`);
    return records || [];
  } catch (error) {
    console.error(`Error exporting ${tableName}:`, error.message);
    return [];
  }
}

/**
 * Main export function
 */
async function exportData() {
  console.log('🔍 Checking database connection...\n');

  // Check if tables exist and have data
  const tableCounts = {};
  let totalRecords = 0;

  for (const table of TABLES) {
    try {
      const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${table}"`);
      tableCounts[table] = Number(result[0]?.count || 0);
      totalRecords += tableCounts[table];
    } catch (error) {
      tableCounts[table] = 0;
    }
  }

  console.log('📊 Data counts:');
  for (const [table, count] of Object.entries(tableCounts)) {
    console.log(`  ${table}: ${count}`);
  }
  console.log(`  Total: ${totalRecords}\n`);

  if (totalRecords === 0) {
    console.log('✅ Database is EMPTY - no export needed\n');
    await prisma.$disconnect();
    return;
  }

  console.log('🚀 Starting data export...\n');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Generate SQL file
  const sqlStatements = [];

  for (const table of TABLES) {
    if (tableCounts[table] === 0) {
      console.log(`⏭️  Skipping ${table} (no data)`);
      continue;
    }

    console.log(`📦 Exporting ${table}...`);
    const records = await exportTable(table);

    if (records.length > 0) {
      sqlStatements.push(`-- ${table} (${records.length} records)\n`);
      for (const record of records) {
        sqlStatements.push(generateInsert(table, record));
      }
      sqlStatements.push('\n');
      console.log(`   ✓ Exported ${records.length} records`);
    }
  }

  // Write to file
  const header = `-- SOS360 Data Export
-- Generated: ${new Date().toISOString()}
-- Source: Supabase PostgreSQL
-- Total Records: ${totalRecords}

-- Disable triggers and foreign key checks
SET session_replication_role = 'replica';

`;

  const footer = `
-- Re-enable triggers and foreign key checks
SET session_replication_role = 'origin';

-- End of export
`;

  const fullSql = header + sqlStatements.join('') + footer;

  fs.writeFileSync(OUTPUT_FILE, fullSql, 'utf8');

  const stats = fs.statSync(OUTPUT_FILE);
  const sizeKB = (stats.size / 1024).toFixed(2);

  console.log('\n✅ Export completed successfully!');
  console.log(`   File: ${OUTPUT_FILE}`);
  console.log(`   Size: ${sizeKB} KB\n`);

  await prisma.$disconnect();
}

// Run export
exportData().catch(error => {
  console.error('❌ Export failed:', error);
  process.exit(1);
});
