import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create system workflow templates
  const templates = [
    {
      name: 'Welcome Sequence',
      description: 'Automatically send a welcome message and follow-up when new leads enter your pipeline',
      category: 'onboarding',
      thumbnail: null,
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger_lead_stage_entry',
          config: { pipelineStageId: 'new_leads_stage' },
          position: { x: 250, y: 0 }
        },
        {
          id: 'action-1',
          type: 'action_send_message',
          config: {
            template: 'Hi {{firstName}}! Thanks for connecting. I\'d love to learn more about your work at {{company}}.'
          },
          position: { x: 250, y: 150 }
        },
        {
          id: 'delay-1',
          type: 'delay',
          config: { delaySeconds: 86400 }, // 1 day
          position: { x: 250, y: 300 }
        },
        {
          id: 'action-2',
          type: 'action_add_tag',
          config: { tag: 'welcomed' },
          position: { x: 250, y: 450 }
        },
        {
          id: 'end-1',
          type: 'end',
          config: {},
          position: { x: 250, y: 600 }
        }
      ],
      edges: [
        { id: 'edge-1', sourceNodeId: 'trigger-1', targetNodeId: 'action-1', config: {} },
        { id: 'edge-2', sourceNodeId: 'action-1', targetNodeId: 'delay-1', config: {} },
        { id: 'edge-3', sourceNodeId: 'delay-1', targetNodeId: 'action-2', config: {} },
        { id: 'edge-4', sourceNodeId: 'action-2', targetNodeId: 'end-1', config: {} }
      ],
      isSystem: true,
      stats: { uses: 0 }
    },
    {
      name: 'Lead Nurturing',
      description: 'Nurture leads with personalized messages based on their engagement score',
      category: 'nurturing',
      thumbnail: null,
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger_lead_score_change',
          config: { scoreThreshold: 50 },
          position: { x: 250, y: 0 }
        },
        {
          id: 'condition-1',
          type: 'condition',
          config: {
            conditionField: 'score',
            conditionOperator: 'gte',
            conditionValue: 75
          },
          position: { x: 250, y: 150 }
        },
        {
          id: 'action-1',
          type: 'action_send_message',
          config: {
            template: 'Hi {{firstName}}, I noticed you\'re highly engaged. Would you be interested in a quick call?'
          },
          position: { x: 100, y: 350 }
        },
        {
          id: 'action-2',
          type: 'action_add_tag',
          config: { tag: 'hot-lead' },
          position: { x: 100, y: 500 }
        },
        {
          id: 'action-3',
          type: 'action_send_message',
          config: {
            template: 'Hi {{firstName}}, thanks for your interest! Here\'s some more information about our services.'
          },
          position: { x: 400, y: 350 }
        },
        {
          id: 'action-4',
          type: 'action_add_tag',
          config: { tag: 'warm-lead' },
          position: { x: 400, y: 500 }
        },
        {
          id: 'end-1',
          type: 'end',
          config: {},
          position: { x: 250, y: 650 }
        }
      ],
      edges: [
        { id: 'edge-1', sourceNodeId: 'trigger-1', targetNodeId: 'condition-1', config: {} },
        { id: 'edge-2', sourceNodeId: 'condition-1', targetNodeId: 'action-1', config: { condition: 'true', label: 'Score >= 75' } },
        { id: 'edge-3', sourceNodeId: 'action-1', targetNodeId: 'action-2', config: {} },
        { id: 'edge-4', sourceNodeId: 'action-2', targetNodeId: 'end-1', config: {} },
        { id: 'edge-5', sourceNodeId: 'condition-1', targetNodeId: 'action-3', config: { condition: 'false', label: 'Score < 75' } },
        { id: 'edge-6', sourceNodeId: 'action-3', targetNodeId: 'action-4', config: {} },
        { id: 'edge-7', sourceNodeId: 'action-4', targetNodeId: 'end-1', config: {} }
      ],
      isSystem: true,
      stats: { uses: 0 }
    },
    {
      name: 'Follow-up on No Response',
      description: 'Automatically follow up with leads who haven\'t responded to your initial message',
      category: 'follow-up',
      thumbnail: null,
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger_time_based',
          config: {
            scheduledTime: '09:00'
          },
          position: { x: 250, y: 0 }
        },
        {
          id: 'condition-1',
          type: 'condition',
          config: {
            conditionField: 'lastMessageAt',
            conditionOperator: 'is_empty',
            conditionValue: null
          },
          position: { x: 250, y: 150 }
        },
        {
          id: 'action-1',
          type: 'action_send_message',
          config: {
            template: 'Hi {{firstName}}, just wanted to follow up on my previous message. Do you have time to chat this week?'
          },
          position: { x: 250, y: 350 }
        },
        {
          id: 'delay-1',
          type: 'delay',
          config: { delaySeconds: 432000 }, // 5 days
          position: { x: 250, y: 500 }
        },
        {
          id: 'action-2',
          type: 'action_send_message',
          config: {
            template: 'Hi {{firstName}}, I\'ll touch base again in a few weeks. Feel free to reach out if you need anything in the meantime!'
          },
          position: { x: 250, y: 650 }
        },
        {
          id: 'action-3',
          type: 'action_add_tag',
          config: { tag: 'no-response' },
          position: { x: 250, y: 800 }
        },
        {
          id: 'end-1',
          type: 'end',
          config: {},
          position: { x: 250, y: 950 }
        }
      ],
      edges: [
        { id: 'edge-1', sourceNodeId: 'trigger-1', targetNodeId: 'condition-1', config: {} },
        { id: 'edge-2', sourceNodeId: 'condition-1', targetNodeId: 'action-1', config: { condition: 'true', label: 'No messages' } },
        { id: 'edge-3', sourceNodeId: 'action-1', targetNodeId: 'delay-1', config: {} },
        { id: 'edge-4', sourceNodeId: 'delay-1', targetNodeId: 'action-2', config: {} },
        { id: 'edge-5', sourceNodeId: 'action-2', targetNodeId: 'action-3', config: {} },
        { id: 'edge-6', sourceNodeId: 'action-3', targetNodeId: 'end-1', config: {} }
      ],
      isSystem: true,
      stats: { uses: 0 }
    },
    {
      name: 'Event-Based Trigger',
      description: 'Trigger workflows when leads are added to audiences or change fields',
      category: 'automation',
      thumbnail: null,
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger_lead_field_change',
          config: {
            fieldName: 'status',
            fieldValue: 'qualified'
          },
          position: { x: 250, y: 0 }
        },
        {
          id: 'action-1',
          type: 'action_change_stage',
          config: { targetStageId: 'qualified_stage' },
          position: { x: 250, y: 150 }
        },
        {
          id: 'action-2',
          type: 'action_assign_user',
          config: { assignedUserId: 'sales-rep-1' },
          position: { x: 250, y: 300 }
        },
        {
          id: 'action-3',
          type: 'action_add_to_audience',
          config: { audienceId: 'qualified-leads-audience' },
          position: { x: 250, y: 450 }
        },
        {
          id: 'action-4',
          type: 'action_increment_score',
          config: { scoreIncrement: 10 },
          position: { x: 250, y: 600 }
        },
        {
          id: 'end-1',
          type: 'end',
          config: {},
          position: { x: 250, y: 750 }
        }
      ],
      edges: [
        { id: 'edge-1', sourceNodeId: 'trigger-1', targetNodeId: 'action-1', config: {} },
        { id: 'edge-2', sourceNodeId: 'action-1', targetNodeId: 'action-2', config: {} },
        { id: 'edge-3', sourceNodeId: 'action-2', targetNodeId: 'action-3', config: {} },
        { id: 'edge-4', sourceNodeId: 'action-3', targetNodeId: 'action-4', config: {} },
        { id: 'edge-5', sourceNodeId: 'action-4', targetNodeId: 'end-1', config: {} }
      ],
      isSystem: true,
      stats: { uses: 0 }
    }
  ];

  // Check if templates already exist
  const existingTemplates = await prisma.workflowTemplate.findMany({
    where: { isSystem: true }
  });

  if (existingTemplates.length > 0) {
    console.log(`Found ${existingTemplates.length} existing system templates. Skipping seed.`);
    return;
  }

  // Create templates
  for (const template of templates) {
    await prisma.workflowTemplate.create({
      data: {
        name: template.name,
        description: template.description,
        category: template.category,
        thumbnail: template.thumbnail,
        nodes: template.nodes as any,
        edges: template.edges as any,
        isSystem: template.isSystem,
        stats: template.stats as any
      }
    });
    console.log(`✓ Created template: ${template.name}`);
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
