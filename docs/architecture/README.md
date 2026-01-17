# Documentação de Arquitetura - SnapLeads MVP

Este diretório contém a documentação técnica completa para o MVP de 3 meses do sistema de prospecção outbound.

## Documentos

| Documento | Descrição |
|-----------|-----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Visão geral da arquitetura, stack tecnológico, decisões técnicas |
| [C4-DIAGRAMS.md](./C4-DIAGRAMS.md) | Diagramas C4 detalhados (contexto, containers, componentes) |
| [API-SPEC.md](./API-SPEC.md) | Especificação completa da API REST e WebSocket |
| [DATA-MODEL.md](./DATA-MODEL.md) | Modelo de dados PostgreSQL com Prisma schema |
| [SECURITY.md](./SECURITY.md) | Requisitos de segurança, autenticação, autorização |

## Resumo do MVP (3 meses)

### Mês 1: Fundação
- Setup de infraestrutura (monorepo, Docker, CI/CD)
- Autenticação JWT completa
- CRUD de leads com importação CSV
- Dashboard básico

### Mês 2: Extensão e Importação
- Extensão Chrome (Manifest V3)
- Scraping Instagram, Facebook, LinkedIn
- Sistema de tags e filtros
- Kanban de leads

### Mês 3: Comunicação e Automação
- Inbox unificado
- Templates de mensagens
- Automações simples (trigger → action)
- Analytics básico

## Stack Tecnológico

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│   Next.js 14 · React 18 · Tailwind · shadcn/ui · Zustand   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
│      Express · Node.js 20 · Prisma · Socket.io · Bull       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                          Data                                │
│              PostgreSQL 15 · Redis 7 · S3                   │
└─────────────────────────────────────────────────────────────┘
```

## Estrutura do Monorepo

```
sos360/
├── apps/
│   ├── web/           # Next.js frontend
│   ├── api/           # Express backend
│   └── extension/     # Chrome extension
├── packages/
│   ├── database/      # Prisma schema
│   ├── shared/        # Types, utils
│   └── ui/            # Componentes
├── docs/
│   └── architecture/  # ← Você está aqui
└── docker-compose.yml
```

## Como usar esta documentação

1. **Iniciando**: Leia [ARCHITECTURE.md](./ARCHITECTURE.md) para entender a visão geral
2. **Visualizando fluxos**: Consulte [C4-DIAGRAMS.md](./C4-DIAGRAMS.md) para diagramas
3. **Implementando APIs**: Use [API-SPEC.md](./API-SPEC.md) como referência
4. **Modelando dados**: Siga [DATA-MODEL.md](./DATA-MODEL.md) para o Prisma schema
5. **Segurança**: Implemente os requisitos de [SECURITY.md](./SECURITY.md)

## Próximos Passos

Após revisar esta documentação:

1. **Setup do projeto**: Inicializar monorepo com Turborepo
2. **Configurar banco**: Criar schema Prisma e rodar migrations
3. **Implementar auth**: Sistema JWT com refresh tokens
4. **Desenvolver API**: Endpoints de leads e conversas
5. **Criar extensão**: Scaffold da extensão Chrome
6. **Desenvolver frontend**: Dashboard e inbox

## Contribuindo

Ao atualizar a arquitetura:

1. Mantenha os diagramas sincronizados com o código
2. Documente decisões técnicas significativas
3. Atualize os contratos de API antes de implementar
4. Revise requisitos de segurança para novas features
