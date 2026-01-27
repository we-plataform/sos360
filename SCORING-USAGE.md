# Como Usar o Sistema de Scoring

## 1. Configurar um Modelo de Scoring

No frontend, você pode configurar o scoring para cada pipeline:

```tsx
import { ScoringModelEditor } from '@/components/scoring';

export function PipelineSettings({ pipelineId }: { pipelineId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Configurar Scoring</Button>

      <ScoringModelEditor
        pipelineId={pipelineId}
        open={open}
        onOpenChange={setOpen}
        onSave={() => {
          // Recarregar leads após salvar
          window.location.reload();
        }}
      />
    </>
  );
}
```

## 2. Mostrar Score nos Cards dos Leads

```tsx
import { ScoreBadge } from '@/components/scoring';
import { ScoreBreakdownModal } from '@/components/scoring';

export function LeadCard({ lead }: { lead: Lead }) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  return (
    <div className="lead-card">
      <div className="flex justify-between items-start">
        <div>
          <h3>{lead.fullName}</h3>
          <p>{lead.jobTitle}</p>
        </div>

        <ScoreBadge
          score={lead.score}
          onClick={() => setBreakdownOpen(true)}
        />
      </div>

      <ScoreBreakdownModal
        leadId={lead.id}
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
      />
    </div>
  );
}
```

## 3. API Requests

### Obter Score Breakdown

```typescript
const response = await api.get(`/api/v1/leads/${leadId}/score-breakdown`);
const { score, factors, classification, history } = response.data;
```

### Rescore Manualmente

```typescript
const response = await api.post(`/api/v1/leads/${leadId}/rescore`, {
  force: true
});
const { score, classification } = response.data;
```

### Batch Rescore

```typescript
const response = await api.post('/api/v1/leads/batch-rescore', {
  pipelineId: 'pipeline-123'
  // ou leadIds: ['lead-1', 'lead-2', ...]
});
```

## Classificação

Os leads são classificados automaticamente:

- **🔥 Hot** (score ≥ 80): Alta prioridade
- **⚡ Warm** (score ≥ 50): Média prioridade
- **❄️ Cold** (score < 50): Baixa prioridade

## Fatores de Scoring

1. **Job Title Match** (0-100)
   - Baseado em: jobTitle, headline, experiences
   - Critérios: target titles, exclude titles, seniority

2. **Company Relevance** (0-100)
   - Baseado em: company, industry, companySize
   - Critérios: target industries, company sizes

3. **Engagement** (0-100)
   - Baseado em: followersCount, connectionCount, postsCount, verified
   - Critérios: minimum followers/connections, recent posts

4. **Profile Completeness** (0-100)
   - Baseado em: email, phone, bio, location, website, enrichment data
   - Critérios: required fields, bonus fields
