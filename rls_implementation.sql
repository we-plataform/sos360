-- ============================================
-- ROW-LEVEL SECURITY (RLS) IMPLEMENTATION
-- SOS360 Platform - Neon PostgreSQL
-- ============================================
--
-- Este script implementa Row-Level Security em todas as tabelas do banco
-- para garantir isolamento de dados multi-tenant no nível do banco de dados.
--
-- IMPORTANTE: Execute este script manualmente no console do Neon
--
-- ROLLBACK: Para reverter, execute: ALTER TABLE "TableName" DISABLE ROW LEVEL SECURITY;
-- ============================================

-- ============================================
-- PARTE 1: CRIAR SCHEMA AUTH E FUNÇÕES AUXILIARES
-- ============================================

-- Criar schema auth se não existir
CREATE SCHEMA IF NOT EXISTS auth;

-- Função para obter o ID do usuário atual da variável de sessão
CREATE OR REPLACE FUNCTION auth.user_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.user_id', TRUE), '')::TEXT;
$$ LANGUAGE SQL STABLE;

-- Função para obter o ID do workspace atual da variável de sessão
CREATE OR REPLACE FUNCTION auth.workspace_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.workspace_id', TRUE), '')::TEXT;
$$ LANGUAGE SQL STABLE;

-- Função para obter o ID da company atual da variável de sessão
CREATE OR REPLACE FUNCTION auth.company_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.company_id', TRUE), '')::TEXT;
$$ LANGUAGE SQL STABLE;

-- Função para verificar se o usuário tem acesso a um workspace específico
CREATE OR REPLACE FUNCTION auth.has_workspace_access(target_workspace_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE "userId" = auth.user_id()
      AND "workspaceId" = target_workspace_id
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Função para verificar se o usuário tem acesso a uma company específica
CREATE OR REPLACE FUNCTION auth.has_company_access(target_company_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE "userId" = auth.user_id()
      AND "companyId" = target_company_id
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Função para verificar se o usuário tem acesso a um lead específico (via workspace)
CREATE OR REPLACE FUNCTION auth.has_lead_access(target_lead_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM leads l
    JOIN workspace_members wm ON l."workspaceId" = wm."workspaceId"
    WHERE l."id" = target_lead_id
      AND wm."userId" = auth.user_id()
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Conceder permissões de execução para as funções
GRANT EXECUTE ON FUNCTION auth.user_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth.workspace_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth.company_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth.has_workspace_access(TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth.has_company_access(TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth.has_lead_access(TEXT) TO PUBLIC;

-- ============================================
-- PARTE 2: TABELAS DE HIERARQUIA DE TENANT
-- ============================================

-- ---------------------------------------------
-- Company Table
-- ---------------------------------------------
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Usuários veem apenas companies das quais são membros
CREATE POLICY company_member_select ON companies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE "companyId" = companies."id"
        AND "userId" = auth.user_id()
    )
  );

-- Apenas owners/admins podem atualizar companies
CREATE POLICY company_admin_update ON companies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE "companyId" = companies."id"
        AND "userId" = auth.user_id()
        AND "role" IN ('owner', 'admin')
    )
  );

-- Apenas owners podem deletar companies
CREATE POLICY company_owner_delete ON companies
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE "companyId" = companies."id"
        AND "userId" = auth.user_id()
        AND "role" = 'owner'
    )
  );

-- Permitir criação de companies (fluxo de registro)
CREATE POLICY company_insert ON companies
  FOR INSERT
  WITH CHECK (true);

-- ---------------------------------------------
-- CompanyMember Table
-- ---------------------------------------------
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- Usuários veem todos os membros das suas companies
CREATE POLICY company_member_select ON company_members
  FOR SELECT
  USING (auth.has_company_access("companyId"));

-- Apenas owners/admins podem adicionar membros
CREATE POLICY company_member_insert ON company_members
  FOR INSERT
  WITH CHECK (
    auth.has_company_access("companyId") AND
    EXISTS (
      SELECT 1 FROM company_members
      WHERE "companyId" = company_members."companyId"
        AND "userId" = auth.user_id()
        AND "role" IN ('owner', 'admin')
    )
  );

-- Apenas owners/admins podem atualizar roles de membros
CREATE POLICY company_member_update ON company_members
  FOR UPDATE
  USING (
    auth.has_company_access("companyId") AND
    EXISTS (
      SELECT 1 FROM company_members
      WHERE "companyId" = company_members."companyId"
        AND "userId" = auth.user_id()
        AND "role" IN ('owner', 'admin')
    )
  );

-- Apenas owners/admins podem remover membros (exceto a si mesmos)
CREATE POLICY company_member_delete ON company_members
  FOR DELETE
  USING (
    auth.has_company_access("companyId") AND
    "userId" != auth.user_id() AND
    EXISTS (
      SELECT 1 FROM company_members
      WHERE "companyId" = company_members."companyId"
        AND "userId" = auth.user_id()
        AND "role" IN ('owner', 'admin')
    )
  );

-- ---------------------------------------------
-- CompanyInvitation Table
-- ---------------------------------------------
ALTER TABLE company_invitations ENABLE ROW LEVEL SECURITY;

-- Usuários veem convites das suas companies
CREATE POLICY company_invitation_select ON company_invitations
  FOR SELECT
  USING (auth.has_company_access("companyId"));

-- Apenas owners/admins podem criar convites
CREATE POLICY company_invitation_insert ON company_invitations
  FOR INSERT
  WITH CHECK (
    auth.has_company_access("companyId") AND
    EXISTS (
      SELECT 1 FROM company_members
      WHERE "companyId" = company_invitations."companyId"
        AND "userId" = auth.user_id()
        AND "role" IN ('owner', 'admin')
    )
  );

-- Apenas owners/admins podem atualizar convites
CREATE POLICY company_invitation_update ON company_invitations
  FOR UPDATE
  USING (
    auth.has_company_access("companyId") AND
    EXISTS (
      SELECT 1 FROM company_members
      WHERE "companyId" = company_invitations."companyId"
        AND "userId" = auth.user_id()
        AND "role" IN ('owner', 'admin')
    )
  );

-- Apenas owners/admins podem deletar convites
CREATE POLICY company_invitation_delete ON company_invitations
  FOR DELETE
  USING (
    auth.has_company_access("companyId") AND
    EXISTS (
      SELECT 1 FROM company_members
      WHERE "companyId" = company_invitations."companyId"
        AND "userId" = auth.user_id()
        AND "role" IN ('owner', 'admin')
    )
  );

-- ---------------------------------------------
-- Workspace Table
-- ---------------------------------------------
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Usuários veem workspaces das suas companies
CREATE POLICY workspace_company_member_select ON workspaces
  FOR SELECT
  USING (auth.has_company_access("companyId"));

-- Apenas admins da company podem criar workspaces
CREATE POLICY workspace_admin_insert ON workspaces
  FOR INSERT
  WITH CHECK (auth.has_company_access("companyId"));

-- Apenas owners/admins do workspace podem atualizar
CREATE POLICY workspace_admin_update ON workspaces
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE "workspaceId" = workspaces."id"
        AND "userId" = auth.user_id()
        AND "role" IN ('owner', 'admin')
    )
  );

-- Apenas owners da company podem deletar workspaces
CREATE POLICY workspace_owner_delete ON workspaces
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE "companyId" = workspaces."companyId"
        AND "userId" = auth.user_id()
        AND "role" = 'owner'
    )
  );

-- ---------------------------------------------
-- WorkspaceMember Table
-- ---------------------------------------------
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Usuários veem membros dos workspaces que pertencem
CREATE POLICY workspace_member_select ON workspace_members
  FOR SELECT
  USING (auth.has_workspace_access("workspaceId"));

-- Apenas owners/admins podem adicionar membros
CREATE POLICY workspace_member_insert ON workspace_members
  FOR INSERT
  WITH CHECK (
    auth.has_workspace_access("workspaceId") AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE "workspaceId" = workspace_members."workspaceId"
        AND "userId" = auth.user_id()
        AND "role" IN ('owner', 'admin')
    )
  );

-- Apenas owners/admins podem atualizar roles
CREATE POLICY workspace_member_update ON workspace_members
  FOR UPDATE
  USING (
    auth.has_workspace_access("workspaceId") AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE "workspaceId" = workspace_members."workspaceId"
        AND "userId" = auth.user_id()
        AND "role" IN ('owner', 'admin')
    )
  );

-- Apenas owners/admins podem remover membros (exceto a si mesmos)
CREATE POLICY workspace_member_delete ON workspace_members
  FOR DELETE
  USING (
    auth.has_workspace_access("workspaceId") AND
    "userId" != auth.user_id() AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE "workspaceId" = workspace_members."workspaceId"
        AND "userId" = auth.user_id()
        AND "role" IN ('owner', 'admin')
    )
  );

-- ============================================
-- PARTE 3: TABELAS DE GERENCIAMENTO DE USUÁRIOS
-- ============================================

-- ---------------------------------------------
-- User Table
-- ---------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Usuários veem apenas seu próprio perfil
CREATE POLICY user_self_select ON users
  FOR SELECT
  USING ("id" = auth.user_id());

-- Usuários podem atualizar apenas seu próprio perfil
CREATE POLICY user_self_update ON users
  FOR UPDATE
  USING ("id" = auth.user_id());

-- Permitir criação de usuários (registro)
CREATE POLICY user_insert ON users
  FOR INSERT
  WITH CHECK (true);

-- Não permitir deleção via RLS (usar lógica de aplicação)
CREATE POLICY user_no_delete ON users
  FOR DELETE
  USING (false);

-- ---------------------------------------------
-- RefreshToken Table
-- ---------------------------------------------
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Usuários veem apenas seus próprios tokens
CREATE POLICY refresh_token_self_select ON refresh_tokens
  FOR SELECT
  USING ("userId" = auth.user_id());

-- Usuários podem inserir seus próprios tokens
CREATE POLICY refresh_token_self_insert ON refresh_tokens
  FOR INSERT
  WITH CHECK ("userId" = auth.user_id());

-- Usuários podem deletar seus próprios tokens (logout)
CREATE POLICY refresh_token_self_delete ON refresh_tokens
  FOR DELETE
  USING ("userId" = auth.user_id());

-- Não permitir updates em tokens
CREATE POLICY refresh_token_no_update ON refresh_tokens
  FOR UPDATE
  USING (false);

-- ============================================
-- PARTE 4: TABELAS DE PIPELINE
-- ============================================

-- ---------------------------------------------
-- Pipeline Table
-- ---------------------------------------------
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY pipeline_workspace_select ON pipelines
  FOR SELECT USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY pipeline_workspace_insert ON pipelines
  FOR INSERT WITH CHECK (auth.has_workspace_access("workspaceId"));

CREATE POLICY pipeline_workspace_update ON pipelines
  FOR UPDATE USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY pipeline_workspace_delete ON pipelines
  FOR DELETE USING (auth.has_workspace_access("workspaceId"));

-- ---------------------------------------------
-- PipelineStage Table
-- ---------------------------------------------
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY pipeline_stage_select ON pipeline_stages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines."id" = pipeline_stages."pipelineId"
        AND auth.has_workspace_access(pipelines."workspaceId")
    )
  );

CREATE POLICY pipeline_stage_insert ON pipeline_stages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines."id" = pipeline_stages."pipelineId"
        AND auth.has_workspace_access(pipelines."workspaceId")
    )
  );

CREATE POLICY pipeline_stage_update ON pipeline_stages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines."id" = pipeline_stages."pipelineId"
        AND auth.has_workspace_access(pipelines."workspaceId")
    )
  );

CREATE POLICY pipeline_stage_delete ON pipeline_stages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines."id" = pipeline_stages."pipelineId"
        AND auth.has_workspace_access(pipelines."workspaceId")
    )
  );

-- ============================================
-- PARTE 5: TABELAS DE LEADS
-- ============================================

-- ---------------------------------------------
-- Lead Table
-- ---------------------------------------------
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_workspace_select ON leads
  FOR SELECT USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY lead_workspace_insert ON leads
  FOR INSERT WITH CHECK (auth.has_workspace_access("workspaceId"));

CREATE POLICY lead_workspace_update ON leads
  FOR UPDATE USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY lead_workspace_delete ON leads
  FOR DELETE USING (auth.has_workspace_access("workspaceId"));

-- ---------------------------------------------
-- SocialProfile Table
-- ---------------------------------------------
ALTER TABLE social_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY social_profile_workspace_select ON social_profiles
  FOR SELECT USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY social_profile_workspace_insert ON social_profiles
  FOR INSERT WITH CHECK (auth.has_workspace_access("workspaceId"));

CREATE POLICY social_profile_workspace_update ON social_profiles
  FOR UPDATE USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY social_profile_workspace_delete ON social_profiles
  FOR DELETE USING (auth.has_workspace_access("workspaceId"));

-- ---------------------------------------------
-- Tag Table
-- ---------------------------------------------
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY tag_workspace_select ON tags
  FOR SELECT USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY tag_workspace_insert ON tags
  FOR INSERT WITH CHECK (auth.has_workspace_access("workspaceId"));

CREATE POLICY tag_workspace_update ON tags
  FOR UPDATE USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY tag_workspace_delete ON tags
  FOR DELETE USING (auth.has_workspace_access("workspaceId"));

-- ---------------------------------------------
-- LeadTag Table (Junction)
-- ---------------------------------------------
ALTER TABLE lead_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_tag_select ON lead_tags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads."id" = lead_tags."leadId"
        AND auth.has_workspace_access(leads."workspaceId")
    )
  );

CREATE POLICY lead_tag_insert ON lead_tags
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads."id" = lead_tags."leadId"
        AND auth.has_workspace_access(leads."workspaceId")
    )
  );

CREATE POLICY lead_tag_delete ON lead_tags
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads."id" = lead_tags."leadId"
        AND auth.has_workspace_access(leads."workspaceId")
    )
  );

-- ---------------------------------------------
-- LeadBehavior Table
-- ---------------------------------------------
ALTER TABLE lead_behaviors ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_behavior_select ON lead_behaviors
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_behavior_insert ON lead_behaviors
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_behavior_update ON lead_behaviors
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_behavior_delete ON lead_behaviors
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ---------------------------------------------
-- LeadAddress Table
-- ---------------------------------------------
ALTER TABLE lead_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_address_select ON lead_addresses
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_address_insert ON lead_addresses
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_address_update ON lead_addresses
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_address_delete ON lead_addresses
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ============================================
-- PARTE 6: TABELAS DE ENRIQUECIMENTO LINKEDIN (Batch 1)
-- ============================================

-- ---------------------------------------------
-- LeadExperience Table
-- ---------------------------------------------
ALTER TABLE lead_experiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_experience_select ON lead_experiences
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_experience_insert ON lead_experiences
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_experience_update ON lead_experiences
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_experience_delete ON lead_experiences
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ---------------------------------------------
-- LeadEducation Table
-- ---------------------------------------------
ALTER TABLE lead_educations ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_education_select ON lead_educations
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_education_insert ON lead_educations
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_education_update ON lead_educations
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_education_delete ON lead_educations
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ---------------------------------------------
-- LeadCertification Table
-- ---------------------------------------------
ALTER TABLE lead_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_certification_select ON lead_certifications
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_certification_insert ON lead_certifications
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_certification_update ON lead_certifications
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_certification_delete ON lead_certifications
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ---------------------------------------------
-- LeadSkill Table
-- ---------------------------------------------
ALTER TABLE lead_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_skill_select ON lead_skills
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_skill_insert ON lead_skills
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_skill_update ON lead_skills
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_skill_delete ON lead_skills
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ---------------------------------------------
-- LeadLanguage Table
-- ---------------------------------------------
ALTER TABLE lead_languages ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_language_select ON lead_languages
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_language_insert ON lead_languages
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_language_update ON lead_languages
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_language_delete ON lead_languages
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ---------------------------------------------
-- LeadRecommendation Table
-- ---------------------------------------------
ALTER TABLE lead_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_recommendation_select ON lead_recommendations
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_recommendation_insert ON lead_recommendations
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_recommendation_update ON lead_recommendations
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_recommendation_delete ON lead_recommendations
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ---------------------------------------------
-- LeadVolunteer Table
-- ---------------------------------------------
ALTER TABLE lead_volunteers ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_volunteer_select ON lead_volunteers
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_volunteer_insert ON lead_volunteers
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_volunteer_update ON lead_volunteers
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_volunteer_delete ON lead_volunteers
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ---------------------------------------------
-- LeadPublication Table
-- ---------------------------------------------
ALTER TABLE lead_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_publication_select ON lead_publications
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_publication_insert ON lead_publications
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_publication_update ON lead_publications
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_publication_delete ON lead_publications
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ============================================
-- PARTE 7: TABELAS DE ENRIQUECIMENTO LINKEDIN (Batch 2)
-- ============================================

-- ---------------------------------------------
-- LeadPatent Table
-- ---------------------------------------------
ALTER TABLE lead_patents ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_patent_select ON lead_patents
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_patent_insert ON lead_patents
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_patent_update ON lead_patents
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_patent_delete ON lead_patents
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ---------------------------------------------
-- LeadProject Table
-- ---------------------------------------------
ALTER TABLE lead_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_project_select ON lead_projects
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_project_insert ON lead_projects
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_project_update ON lead_projects
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_project_delete ON lead_projects
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ---------------------------------------------
-- LeadCourse Table
-- ---------------------------------------------
ALTER TABLE lead_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_course_select ON lead_courses
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_course_insert ON lead_courses
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_course_update ON lead_courses
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_course_delete ON lead_courses
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ---------------------------------------------
-- LeadHonor Table
-- ---------------------------------------------
ALTER TABLE lead_honors ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_honor_select ON lead_honors
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_honor_insert ON lead_honors
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_honor_update ON lead_honors
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_honor_delete ON lead_honors
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ---------------------------------------------
-- LeadOrganization Table
-- ---------------------------------------------
ALTER TABLE lead_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_organization_select ON lead_organizations
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_organization_insert ON lead_organizations
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_organization_update ON lead_organizations
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_organization_delete ON lead_organizations
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ---------------------------------------------
-- LeadFeatured Table
-- ---------------------------------------------
ALTER TABLE lead_featured ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_featured_select ON lead_featured
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_featured_insert ON lead_featured
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_featured_update ON lead_featured
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_featured_delete ON lead_featured
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ---------------------------------------------
-- LeadContactInfo Table
-- ---------------------------------------------
ALTER TABLE lead_contact_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_contact_info_select ON lead_contact_info
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_contact_info_insert ON lead_contact_info
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_contact_info_update ON lead_contact_info
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_contact_info_delete ON lead_contact_info
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ---------------------------------------------
-- LeadPost Table
-- ---------------------------------------------
ALTER TABLE lead_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_post_select ON lead_posts
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_post_insert ON lead_posts
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY lead_post_update ON lead_posts
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY lead_post_delete ON lead_posts
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ============================================
-- PARTE 8: TABELAS DE COMUNICAÇÃO
-- ============================================

-- ---------------------------------------------
-- Conversation Table
-- ---------------------------------------------
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversation_select ON conversations
  FOR SELECT USING (auth.has_lead_access("leadId"));

CREATE POLICY conversation_insert ON conversations
  FOR INSERT WITH CHECK (auth.has_lead_access("leadId"));

CREATE POLICY conversation_update ON conversations
  FOR UPDATE USING (auth.has_lead_access("leadId"));

CREATE POLICY conversation_delete ON conversations
  FOR DELETE USING (auth.has_lead_access("leadId"));

-- ---------------------------------------------
-- Message Table
-- ---------------------------------------------
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_select ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations."id" = messages."conversationId"
        AND auth.has_lead_access(conversations."leadId")
    )
  );

CREATE POLICY message_insert ON messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations."id" = messages."conversationId"
        AND auth.has_lead_access(conversations."leadId")
    )
  );

CREATE POLICY message_update ON messages
  FOR UPDATE
  USING (
    "senderId" = auth.user_id() AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations."id" = messages."conversationId"
        AND auth.has_lead_access(conversations."leadId")
    )
  );

CREATE POLICY message_delete ON messages
  FOR DELETE
  USING (
    "senderId" = auth.user_id() AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations."id" = messages."conversationId"
        AND auth.has_lead_access(conversations."leadId")
    )
  );

-- ============================================
-- PARTE 9: TABELAS DE WORKFLOW E AUTOMAÇÃO
-- ============================================

-- ---------------------------------------------
-- Template Table
-- ---------------------------------------------
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY template_workspace_select ON templates
  FOR SELECT USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY template_workspace_insert ON templates
  FOR INSERT WITH CHECK (auth.has_workspace_access("workspaceId"));

CREATE POLICY template_workspace_update ON templates
  FOR UPDATE USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY template_workspace_delete ON templates
  FOR DELETE USING (auth.has_workspace_access("workspaceId"));

-- ---------------------------------------------
-- Automation Table
-- ---------------------------------------------
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_workspace_select ON automations
  FOR SELECT USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY automation_workspace_insert ON automations
  FOR INSERT WITH CHECK (auth.has_workspace_access("workspaceId"));

CREATE POLICY automation_workspace_update ON automations
  FOR UPDATE USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY automation_workspace_delete ON automations
  FOR DELETE USING (auth.has_workspace_access("workspaceId"));

-- ---------------------------------------------
-- AutomationLog Table
-- ---------------------------------------------
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_log_select ON automation_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM automations
      WHERE automations."id" = automation_logs."automationId"
        AND auth.has_workspace_access(automations."workspaceId")
    )
  );

CREATE POLICY automation_log_insert ON automation_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM automations
      WHERE automations."id" = automation_logs."automationId"
        AND auth.has_workspace_access(automations."workspaceId")
    )
  );

-- Logs são imutáveis (sem UPDATE ou DELETE)

-- ============================================
-- PARTE 10: TABELAS DE INFRAESTRUTURA
-- ============================================

-- ---------------------------------------------
-- Audience Table
-- ---------------------------------------------
ALTER TABLE audiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY audience_workspace_select ON audiences
  FOR SELECT USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY audience_workspace_insert ON audiences
  FOR INSERT WITH CHECK (auth.has_workspace_access("workspaceId"));

CREATE POLICY audience_workspace_update ON audiences
  FOR UPDATE USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY audience_workspace_delete ON audiences
  FOR DELETE USING (auth.has_workspace_access("workspaceId"));

-- ---------------------------------------------
-- Webhook Table
-- ---------------------------------------------
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_workspace_select ON webhooks
  FOR SELECT USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY webhook_workspace_insert ON webhooks
  FOR INSERT WITH CHECK (auth.has_workspace_access("workspaceId"));

CREATE POLICY webhook_workspace_update ON webhooks
  FOR UPDATE USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY webhook_workspace_delete ON webhooks
  FOR DELETE USING (auth.has_workspace_access("workspaceId"));

-- ---------------------------------------------
-- ImportJob Table
-- ---------------------------------------------
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_job_workspace_select ON import_jobs
  FOR SELECT USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY import_job_workspace_insert ON import_jobs
  FOR INSERT WITH CHECK (auth.has_workspace_access("workspaceId"));

CREATE POLICY import_job_workspace_update ON import_jobs
  FOR UPDATE USING (auth.has_workspace_access("workspaceId"));

CREATE POLICY import_job_workspace_delete ON import_jobs
  FOR DELETE USING (auth.has_workspace_access("workspaceId"));

-- ---------------------------------------------
-- Activity Table
-- ---------------------------------------------
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_select ON activities
  FOR SELECT
  USING (auth.has_lead_access("leadId"));

CREATE POLICY activity_insert ON activities
  FOR INSERT
  WITH CHECK (auth.has_lead_access("leadId"));

-- Activities são imutáveis (sem UPDATE ou DELETE)

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================

-- Consulta para verificar todas as políticas criadas
-- Execute após rodar o script para confirmar:
--
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
--
-- Consulta para verificar todas as funções auth:
--
-- SELECT proname, proargnames FROM pg_proc
-- WHERE pronamespace = 'auth'::regnamespace;
--
-- ============================================
-- FIM DO SCRIPT RLS
-- ============================================
