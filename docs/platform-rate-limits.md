# Limitações de Segurança por Plataforma - Mineração de Leads

> **Última atualização**: Janeiro 2026
> **Aviso**: Estas limitações podem mudar a qualquer momento. Verifique sempre a documentação oficial de cada plataforma.

## 📊 Resumo Executivo

| Plataforma | Tipo de Acesso | Risco de Ban | Recomendação |
|------------|----------------|--------------|--------------|
| **LinkedIn** | Alto risco | Muito Alto | Usar API oficial + proxies |
| **Instagram** | Médio risco | Alto | Respeitar limites estritos |
| **Facebook** | Médio risco | Alto | API Graph API recomendada |
| **X/Twitter** | Baixo risco | Médio | API v2 necessária (paga) |

---

## LinkedIn

### Limitações Oficiais API
- **Limite de desenvolvedor**: 400 chamadas API por 24 horas
- **Limite total da aplicação**: 100.000 chamadas
- **Reset de limites**: A cada hora
- **Limites de conexões**: 50-200 por semana (baseado em reputação)

### Limites Seguros Recomendados (Scraping)

| Operação | Limite Seguro | Frequência | Observações |
|----------|---------------|------------|-------------|
| **Visualização de perfis (People tab)** | 800-1.000 | por dia | Usar delay 5-10s entre requisições |
| **Extração de dados de perfil** | 60-80 | por hora | Comproximadamente 1/minuto |
| **Connection requests** | 20-25 | por dia | Muito alto risco de ban |
| **Profile visits** | 100-150 | por dia | Simular comportamento humano |
| **Search queries** | 50-70 | por dia | Espalhar ao longo do dia |
| **Comments/Posts scraping** | 200-300 | por dia | Delay mínimo 3-5 segundos |

### Sinais de Alerta
- ✅ Pausa automática ao receber "429 Too Many Requests"
- ✅ Usar rotating proxies (mínimo 5-10 IPs diferentes)
- ✅ Randomizar delays entre 3-15 segundos
- ✅ Limitar uso em horários comerciais (9h-18h)
- ⚠️ **Evitar**: Mais de 100 perfis/hora consecutiva

### Fontes
- [LinkedIn Scraping Legal Guide 2026](https://sociavault.com/blog/linkedin-scraping-legal-guide-2026)
- [How to Scrape LinkedIn in 2026](https://scrapfly.io/blog/posts/how-to-scrape-linkedin)
- [LinkedIn Connection Limit Guide 2026](https://linkedapi.io/guides/linkedin-connection-limit-2026/)

---

## Instagram

### Limitações Oficiais API
- **DMs automatizados**: 200 por hora
- **Hashtag search**: 30 hashtags únicos por semana (reset após 7 dias)
- **Rate limiting**: Baseado em Business Use Case (BUC)

### Limites Seguros Recomendados (Scraping)

| Operação | Limite Seguro | Frequência | Observações |
|----------|---------------|------------|-------------|
| **Comentários de posts** | 250-300 | por hora | ~4-5 por minuto |
| **Perfil scraping** | 200-250 | por hora | ~3-4 por minuto |
| **Followers list** | 150-200 | por hora | Delay 8-10s entre requisições |
| **Following list** | 150-200 | por hora | Mesmo limite de followers |
| **Posts de um perfil** | 300-400 | por dia | Espalhar em 6-8 horas |
| **Hashtag scraping** | 500-600 | por dia | 30 hashtags únicos/semana |
| **Stories viewing** | 100-150 | por hora | Delay 15-20s |
| **Likes/Comments automation** | ❌ | **NÃO RECOMENDADO** | Alto risco de ban |

### Melhores Práticas
- ✅ Usar delay mínimo 5-8 segundos entre ações
- ✅ Limitar a 50-60 ações por 10 minutos
- ✅ Respeitar janelas de 24 horas
- ✅ Usar diferentes User-Agents
- ⚠️ **Evitar**: Ações em massa (likes, comments, follows)

### Fontes
- [Instagram Graph API Complete Developer Guide 2026](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2026/)
- [Instagram API Rate Limits Explained](https://creatorflow.so/blog/instagram-api-rate-limits-explained/)
- [Instagram REST API Updates (Dec 2025)](https://www.instagram.com/p/DRx0waiDQnP/)
- [Meta Graph API Rate Limits](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/)

---

## Facebook

### Limitações Oficiais API
- **Chamadas gerais**: 600 chamadas por 600 segundos (por token + IP)
- **Requests por minuto**: 8-12 requests (conservador)
- **Rate limiting**: Dinâmico, não há valores fixos

### Limites Seguros Recomendados (Scraping)

| Operação | Limite Seguro | Frequência | Observações |
|----------|---------------|------------|-------------|
| **Posts de páginas públicas** | 180-200 | por hora | 3 por minuto com delay 20s |
| **Comentários de posts** | 150-200 | por hora | Delay 15-20s entre requisições |
| **Membros de grupos** | 100-150 | por hora | Alto risco, cautela extrema |
| **Profile scraping** | 80-100 | por hora | Apenas perfis públicos |
| **Page info scraping** | 200-250 | por hora | Delay 10-15s |
| **Group posts** | 80-120 | por dia | Muito restrito |

### Melhores Práticas
- ✅ Usar tokens diferentes para diferentes operações
- ✅ Implementar backoff exponencial em caso de erro
- ✅ Respeitar headers de rate-limit nas respostas
- ✅ Cache agressivo para minimizar chamadas
- ⚠️ **Evitar**: Scraping de grupos privados (alto risco legal)

### Fontes
- [Meta Graph API Rate Limits](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/)
- [How to Scrape Facebook in 2026](https://medium.com/@anadilkhalil786/how-to-scrape-facebook-posts-pages-groups-public-data-in-2026-568d58f214c0)
- [Facebook Unofficial APIs 2026](https://data365.co/blog/facebook-unofficial-api)

---

## X (Twitter)

### Limitações Oficiais API v2
- **User lookup**: 900 requisições por 15 minutos (por usuário)
- **User lookup (app-level)**: 300 requisições por 15 minutos
- **Janelas de rate limit**: 15 minutos ou 24 horas
- **API gratuita**: **REMOVIDA** em 2025
- **Custo**: $100-$5.000/mês dependendo do tier

### Limites Seguros Recomendados (Scraping)

| Operação | Limite Seguro | Frequência | Observações |
|----------|---------------|------------|-------------|
| **Profile scraping** | 300-400 | por 15 min | Via API oficial |
| **Tweets de um perfil** | 300-400 | por 15 min | Via API oficial |
| **User timeline** | 300-400 | por 15 min | Inclui retweets |
| **Search tweets** | 200-250 | por 15 min | Endpoint de busca |
| **Followers list** | 100-150 | por 15 min | Muitas limitações |
| **Following list** | 100-150 | por 15 min | Mesmo limite de followers |

### Melhores Práticas
- ✅ **Usar API oficial é praticamente obrigatório**
- ✅ Respeitar headers `x-rate-limit-*`
- ✅ Implementar queue system para respeitar janelas de 15min
- ✅ Monitorar remaining requests nos headers
- ⚠️ **Evitar**: Scraping sem API (web scraping) - bloqueio rápido

### Custo-Benefício
- **Tier Basic ($100/mês)**: Adequado para POC e uso moderado
- **Tier Pro ($5.000/mês)**: Para uso intensivo em produção
- **Alternativa**: Serviços de terceiros (Data365, etc.)

### Fontes
- [X API Rate Limits Official](https://docs.x.com/x-api/fundamentals/rate-limits)
- [X API v2 Postman Collection](https://documenter.getpostman.com/view/9956214/T1LMiT5U)
- [Twitter API Pricing & Limits](https://data365.co/guides/twitter-api-limitations-and-pricing)

---

## 🔒 Estratégias Gerais de Segurança

### Para Todas as Plataformas

1. **Implementar Rate Limiting no Cliente**
   ```javascript
   const rateLimiter = {
     requests: 0,
     windowMs: 60000, // 1 minuto
     maxRequests: 30, // ajustar por plataforma
     lastReset: Date.now()
   };

   async function makeRequest(url) {
     const now = Date.now();
     if (now - rateLimiter.lastReset > rateLimiter.windowMs) {
       rateLimiter.requests = 0;
       rateLimiter.lastReset = now;
     }

     if (rateLimiter.requests >= rateLimiter.maxRequests) {
       const waitTime = rateLimiter.windowMs - (now - rateLimiter.lastReset);
       await new Promise(resolve => setTimeout(resolve, waitTime));
       rateLimiter.requests = 0;
       rateLimiter.lastReset = Date.now();
     }

     rateLimiter.requests++;
     // Fazer request...
   }
   ```

2. **Backoff Exponencial**
   ```javascript
   async function fetchWithBackoff(url, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         const response = await fetch(url);
         if (response.status === 429) {
           const waitTime = Math.pow(2, i) * 1000; // 1s, 2s, 4s
           await new Promise(resolve => setTimeout(resolve, waitTime));
           continue;
         }
         return response;
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
       }
     }
   }
   ```

3. **Rotating Proxies (Essencial para LinkedIn/Instagram)**
   ```javascript
   const proxies = [
     'http://proxy1.example.com:8080',
     'http://proxy2.example.com:8080',
     'http://proxy3.example.com:8080',
   ];

   function getRandomProxy() {
     return proxies[Math.floor(Math.random() * proxies.length)];
   }
   ```

4. **User-Agent Rotation**
   ```javascript
   const userAgents = [
     'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
   ];

   function getRandomUserAgent() {
     return userAgents[Math.floor(Math.random() * userAgents.length)];
   }
   ```

5. **Padrões "Humanos"**
   - ✅ Randomizar delays (3s, 7s, 5s, 11s...)
   - ✅ Pausas periódicas (5-10 min a cada 50-100 ações)
   - ✅ Evitar horários noturnos (00h-06h)
   - ✅ Simular padrões de navegação real

---

## 📈 Recomendações por Caso de Uso

### Para Lia360

| Funcionalidade | Plataforma | Abordagem Recomendada |
|----------------|------------|----------------------|
| **Captura de perfis** | LinkedIn | API oficial + delay 8-10s + proxies |
| **Captura de posts** | Instagram | API Graph + rate limit estrito |
| **Captura de comentários** | Instagram | 250-300/hora com delay 5-8s |
| **Captura de páginas** | Facebook | Graph API + cache agressivo |
| **Captura de tweets** | X | API v2 (necessário plano pago) |
| **Extração de seguidores** | Instagram | 150-200/hora máximo |

---

## ⚠️ Avisos Legais

1. **Termos de Serviço**: Scraping pode violar ToS de todas as plataformas
2. **GDPR/CCPA**: Dados pessoais requerem consentimento na UE/Califórnia
3. **Computer Fraud and Abuse Act (EUA)**: Potencial violação federal
4. **Marketeers**: Podem ter contas suspensas permanentemente

> **Recomendação**: Consultar advogado antes de implementar scraping em escala

---

## 🔄 Atualização e Monitoramento

### Como Manter Este Documento Atualizado

1. **Assinar blogs oficiais** de cada plataforma
2. **Monitorar changelogs** de APIs
3. **Testar limites** em ambiente de desenvolvimento
4. **Comunidade**: Acompanhar discussions no GitHub, Reddit, Stack Overflow

### Ferramentas de Monitoramento

- **Rate limit headers**: Monitorar `x-rate-limit-*` nas respostas
- **Error tracking**: Alertas para 429, 403, 503
- **Account health**: Verificar status da conta periodicamente
- **Proxy performance**: Monitorar taxa de sucesso por proxy

---

## 📞 Suporte

Para dúvidas sobre implementação desses limites na Lia360:
- Verificar `apps/extension/content-scripts/` para implementações existentes
- Consultar documentação oficial de cada plataforma
- Considerar hiring especialistas em anti-bot detection para produção

---

**Documento gerado em**: 26 de Janeiro de 2026
**Próxima revisão recomendada**: Abril de 2026
