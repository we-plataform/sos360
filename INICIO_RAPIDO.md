# 🚀 Início Rápido - Lia 360

## Escolha sua opção

### 🐳 Opção 1: Docker (Recomendado)

**Vantagens:**

- ✅ Funciona offline
- ✅ Ambiente isolado
- ✅ Sem dependência de serviços externos
- ✅ Totalmente gratuito

#### Setup em 3 comandos:

```bash
# 1. Iniciar PostgreSQL e Redis
docker-compose up -d

# 2. Configurar e instalar
cp .env.example.local .env
npm install
npm run db:generate
npm run db:push

# 3. Iniciar aplicação
npm run api:dev
```

**Pronto!** API rodando em `http://localhost:3001`

---

### ☁️ Opção 2: Supabase

**Vantagens:**

- ✅ Managed service (sem instalação)
- ✅ Disponível na nuvem
- ✅ Boa para produção

**Instruções:** Veja [`SETUP.md`](SETUP.md)

---

## ✅ Verificar se está funcionando

### Com Docker:

```bash
# Verificar containers
docker-compose ps

# Testar API
curl http://localhost:3001/health
```

### Com Supabase:

```bash
# Testar API
curl http://localhost:3001/health

# Abrir Prisma Studio
npm run db:studio
```

---

## 📚 Documentação Completa

- **Docker:** [`DOCKER_SETUP.md`](DOCKER_SETUP.md)
- **Supabase:** [`SETUP.md`](SETUP.md)
- **Extensão:** [`TESTE_EXTENSAO.md`](TESTE_EXTENSAO.md)

---

## 🎯 Próximos Passos

1. ✅ API rodando
2. ✅ Banco configurado
3. 📥 [Testar extensão](TESTE_EXTENSAO.md)
4. 🌐 Iniciar frontend: `npm run web:dev`
