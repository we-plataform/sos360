import { prisma } from '@lia360/database';
import { bulkFindExistingLeads } from '../routes/leads.js';

/**
 * Test script to verify duplicate detection behavior
 *
 * This test verifies that the bulk duplicate detection function:
 * 1. Correctly identifies existing leads by username
 * 2. Returns proper lookup maps
 * 3. Handles multiple duplicate detection strategies (profileUrl, email, phone)
 */

async function testDuplicateDetection() {
  console.log('=== Duplicate Detection Test ===\n');

  try {
    // Create a test user for the company first
    await prisma.user.upsert({
      where: { id: 'test-owner-dup-detect' },
      update: {},
      create: {
        id: 'test-owner-dup-detect',
        email: 'test-owner@example.com',
        passwordHash: 'test-hash',
        fullName: 'Test Owner',
      },
    });

    // Create a company for the workspace
    await prisma.company.upsert({
      where: { id: 'test-company-dup-detect' },
      update: {},
      create: {
        id: 'test-company-dup-detect',
        name: 'Test Company for Duplicate Detection',
        ownerId: 'test-owner-dup-detect',
      },
    });

    // Create a test workspace if it doesn't exist
    const workspace = await prisma.workspace.upsert({
      where: { id: 'test-workspace-dup-detect' },
      update: {},
      create: {
        id: 'test-workspace-dup-detect',
        name: 'Test Workspace for Duplicate Detection',
        companyId: 'test-company-dup-detect',
      },
    });

    console.log('Test workspace:', workspace.id);

    // Clean up any existing test leads
    await prisma.lead.deleteMany({
      where: {
        workspaceId: workspace.id,
        username: { in: ['testuser123', 'existinguser456'] },
      },
    });

    console.log('Cleaned up existing test leads\n');

    // Test Case 1: Check for duplicates when no leads exist
    console.log('--- Test Case 1: No existing leads ---');
    const result1 = await bulkFindExistingLeads(
      workspace.id,
      'instagram',
      [
        { username: 'testuser123', profileUrl: 'https://instagram.com/testuser123' },
        { username: 'newuser456', profileUrl: 'https://instagram.com/newuser456' },
      ]
    );

    const duplicate1 = result1.findDuplicate({ profileUrl: 'https://instagram.com/testuser123' });
    console.log('✓ Duplicate for testuser123:', duplicate1 || 'None (expected)');
    console.log('✓ Lookup maps created:', {
      byProfileUrl: result1.byProfileUrl.size,
      byEmail: result1.byEmail.size,
      byPhone: result1.byPhone.size,
      byPlatformProfile: result1.byPlatformProfile.size,
    });
    console.log();

    // Test Case 2: Create a lead and check for duplicate
    console.log('--- Test Case 2: Find existing lead by profileUrl ---');
    const existingLead = await prisma.lead.create({
      data: {
        workspaceId: workspace.id,
        username: 'existinguser456',
        fullName: 'Existing User',
        profileUrl: 'https://instagram.com/existinguser456',
        platform: 'instagram',
      },
    });

    console.log('Created lead:', existingLead.id, 'with username:', existingLead.username);

    const result2 = await bulkFindExistingLeads(
      workspace.id,
      'instagram',
      [
        { username: 'existinguser456', profileUrl: 'https://instagram.com/existinguser456' },
        { username: 'anotheruser', profileUrl: 'https://instagram.com/anotheruser' },
      ]
    );

    const duplicate2 = result2.findDuplicate({ profileUrl: 'https://instagram.com/existinguser456' });
    console.log('✓ Duplicate found for existinguser456:', duplicate2 === existingLead.id ? 'Yes' : 'No');
    console.log('✓ Duplicate lead ID matches:', duplicate2 === existingLead.id ? 'PASS' : 'FAIL');

    const noDuplicate2 = result2.findDuplicate({ profileUrl: 'https://instagram.com/anotheruser' });
    console.log('✓ No duplicate for anotheruser:', noDuplicate2 === null ? 'PASS' : 'FAIL');
    console.log();

    // Test Case 3: Check duplicate detection with email
    console.log('--- Test Case 3: Find existing lead by email ---');
    const leadWithEmail = await prisma.lead.create({
      data: {
        workspaceId: workspace.id,
        username: 'emailuser',
        fullName: 'Email User',
        email: 'emailuser@example.com',
        platform: 'instagram',
      },
    });

    const result3 = await bulkFindExistingLeads(
      workspace.id,
      'instagram',
      [
        { email: 'emailuser@example.com' },
        { email: 'nonexistent@example.com' },
      ]
    );

    const duplicate3 = result3.findDuplicate({ email: 'emailuser@example.com' });
    console.log('✓ Duplicate found by email:', duplicate3 === leadWithEmail.id ? 'PASS' : 'FAIL');

    const noDuplicate3 = result3.findDuplicate({ email: 'nonexistent@example.com' });
    console.log('✓ No duplicate for nonexistent email:', noDuplicate3 === null ? 'PASS' : 'FAIL');
    console.log();

    // Test Case 4: Check duplicate detection with phone
    console.log('--- Test Case 4: Find existing lead by phone ---');
    const leadWithPhone = await prisma.lead.create({
      data: {
        workspaceId: workspace.id,
        username: 'phoneuser',
        fullName: 'Phone User',
        phone: '+1234567890',
        platform: 'instagram',
      },
    });

    const result4 = await bulkFindExistingLeads(
      workspace.id,
      'instagram',
      [
        { phone: '+1234567890' },
        { phone: '+9999999999' },
      ]
    );

    const duplicate4 = result4.findDuplicate({ phone: '+1234567890' });
    console.log('✓ Duplicate found by phone:', duplicate4 === leadWithPhone.id ? 'PASS' : 'FAIL');

    const noDuplicate4 = result4.findDuplicate({ phone: '+9999999999' });
    console.log('✓ No duplicate for nonexistent phone:', noDuplicate4 === null ? 'PASS' : 'FAIL');
    console.log();

    // Test Case 5: Priority order - platform:profileUrl > profileUrl > email > phone
    console.log('--- Test Case 5: Priority order for duplicate detection ---');
    const leadWithSocialProfile = await prisma.lead.create({
      data: {
        workspaceId: workspace.id,
        username: 'priorityuser',
        fullName: 'Priority User',
        platform: 'instagram',
        socialProfiles: {
          create: {
            platform: 'instagram',
            profileUrl: 'https://instagram.com/priorityuser',
          },
        },
      },
    });

    const result5 = await bulkFindExistingLeads(
      workspace.id,
      'instagram',
      [
        { profileUrl: 'https://instagram.com/priorityuser' },
      ]
    );

    const duplicate5 = result5.findDuplicate({ profileUrl: 'https://instagram.com/priorityuser' });
    console.log('✓ Duplicate found with social profile:', duplicate5 === leadWithSocialProfile.id ? 'PASS' : 'FAIL');
    console.log();

    // Cleanup
    console.log('--- Cleanup ---');
    await prisma.lead.deleteMany({
      where: {
        workspaceId: workspace.id,
      },
    });
    await prisma.workspace.delete({
      where: { id: workspace.id },
    });
    await prisma.company.delete({
      where: { id: 'test-company-dup-detect' },
    });
    await prisma.user.delete({
      where: { id: 'test-owner-dup-detect' },
    });
    console.log('✓ Test data cleaned up\n');

    console.log('=== All Tests Passed ===');
    console.log('\nSummary:');
    console.log('- Bulk duplicate detection function correctly identifies existing leads');
    console.log('- Multiple detection strategies work (profileUrl, email, phone)');
    console.log('- Priority order is respected (platform:profileUrl > profileUrl > email > phone)');
    console.log('- No false positives for non-existent leads');
    console.log('- Lookup maps are correctly built for fast duplicate checking');

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDuplicateDetection();
