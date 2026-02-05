/**
 * Test script to verify tag associations work correctly with bulk operations
 *
 * This test verifies that:
 * 1. Tag names are converted to tag IDs correctly
 * 2. Tags are created if they don't exist
 * 3. Bulk tag associations use the correct tag IDs
 */

import { PrismaClient } from '@lia360/database';

const prisma = new PrismaClient();

async function testTagAssociations() {
  console.log('=== Testing Tag Associations with Bulk Operations ===\n');

  // Create a test workspace
  const workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    console.error('❌ No workspace found. Please create a workspace first.');
    process.exit(1);
  }

  const workspaceId = workspace.id;
  console.log(`✓ Using workspace: ${workspaceId}\n`);

  // Test data
  const tagNames = ['tag1', 'tag2', 'tag3'];
  console.log(`Testing with tag names: ${tagNames.join(', ')}\n`);

  // Step 1: Convert tag names to tag IDs (same logic as import endpoint)
  console.log('Step 1: Converting tag names to tag IDs...');
  const uniqueTagNames = Array.from(new Set(tagNames));
  console.log(`  Unique tag names: ${uniqueTagNames.join(', ')}`);

  // Find existing tags
  const existingTags = await prisma.tag.findMany({
    where: {
      workspaceId,
      name: { in: uniqueTagNames },
    },
    select: { id: true, name: true },
  });

  const existingTagsMap = new Map(existingTags.map(t => [t.name, t.id]));
  console.log(`  Found ${existingTags.length} existing tags`);

  const newTagNames = uniqueTagNames.filter(name => !existingTagsMap.has(name));
  console.log(`  New tags to create: ${newTagNames.length > 0 ? newTagNames.join(', ') : 'none'}`);

  // Create new tags that don't exist
  if (newTagNames.length > 0) {
    const createdTags = await prisma.tag.createMany({
      data: newTagNames.map(name => ({
        workspaceId,
        name,
        color: '#808080',
      })),
      skipDuplicates: true,
    });

    console.log(`  Created ${createdTags.count} new tags`);

    // If tags were created, fetch them to get their IDs
    if (createdTags.count > 0) {
      const newTags = await prisma.tag.findMany({
        where: {
          workspaceId,
          name: { in: newTagNames },
        },
        select: { id: true, name: true },
      });
      newTags.forEach(t => existingTagsMap.set(t.name, t.id));
      console.log(`  Fetched IDs for ${newTags.length} newly created tags`);
    }
  }

  // Collect all tag IDs in the same order as input
  const tagIds = tagNames.map(name => existingTagsMap.get(name)!).filter(Boolean);
  console.log(`\n✓ Converted ${tagNames.length} tag names to ${tagIds.length} tag IDs`);
  console.log(`  Tag IDs: ${tagIds.join(', ')}\n`);

  // Step 2: Create test leads
  console.log('Step 2: Creating test leads...');
  const leadsData = [
    {
      username: 'taguser1',
      fullName: 'Tag User 1',
      profileUrl: 'instagram:taguser1',
    },
    {
      username: 'taguser2',
      fullName: 'Tag User 2',
      profileUrl: 'instagram:taguser2',
    },
  ];

  // Create leads
  const createdLeads = await prisma.lead.createMany({
    data: leadsData.map(lead => ({
      workspaceId,
      ...lead,
    })),
  });

  // Fetch created leads with their IDs
  const leads = await prisma.lead.findMany({
    where: {
      workspaceId,
      username: { in: leadsData.map(l => l.username) },
    },
  });

  console.log(`✓ Created ${leads.length} test leads`);
  leads.forEach(lead => console.log(`  - ${lead.username}: ${lead.id}\n`));

  // Step 3: Create bulk tag associations
  console.log('Step 3: Creating bulk tag associations...');
  const tagAssociations: Array<{ leadId: string; tagId: string }> = [];
  for (const lead of leads) {
    for (const tagId of tagIds) {
      tagAssociations.push({ leadId: lead.id, tagId });
    }
  }

  console.log(`  Preparing ${tagAssociations.length} tag associations...`);

  // Use bulkAssociateTags logic (createMany with skipDuplicates)
  await prisma.leadTag.createMany({
    data: tagAssociations,
    skipDuplicates: true,
  });

  console.log(`✓ Created ${tagAssociations.length} tag associations\n`);

  // Step 4: Verify the associations
  console.log('Step 4: Verifying tag associations...');
  const verificationResults = [];

  for (const lead of leads) {
    const leadTags = await prisma.leadTag.findMany({
      where: { leadId: lead.id },
      include: {
        tag: {
          select: { id: true, name: true },
        },
      },
    });

    const tagNamesOnLead = leadTags.map(lt => lt.tag.name);
    const hasAllTags = tagNames.every(tagName => tagNamesOnLead.includes(tagName));

    verificationResults.push({
      lead: lead.username,
      tags: tagNamesOnLead,
      expected: tagNames,
      hasAllTags,
    });

    console.log(`  Lead: ${lead.username}`);
    console.log(`    Tags: ${tagNamesOnLead.join(', ')}`);
    console.log(`    Expected: ${tagNames.join(', ')}`);
    console.log(`    Status: ${hasAllTags ? '✓ PASS' : '✗ FAIL'}\n`);
  }

  // Step 5: Cleanup
  console.log('Step 5: Cleaning up test data...');
  await prisma.leadTag.deleteMany({
    where: {
      leadId: { in: leads.map(l => l.id) },
    },
  });

  await prisma.lead.deleteMany({
    where: {
      id: { in: leads.map(l => l.id) },
    },
  });

  await prisma.tag.deleteMany({
    where: {
      workspaceId,
      name: { in: tagNames },
    },
  });

  console.log('✓ Cleanup complete\n');

  // Final result
  const allPassed = verificationResults.every(r => r.hasAllTags);
  console.log('=== Test Results ===');
  console.log(`Status: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
  console.log(`Total leads tested: ${verificationResults.length}`);
  console.log(`Leads with correct tags: ${verificationResults.filter(r => r.hasAllTags).length}`);

  if (!allPassed) {
    process.exit(1);
  }
}

testTagAssociations()
  .then(() => {
    console.log('\n✓ Tag associations working correctly with bulk operations!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
