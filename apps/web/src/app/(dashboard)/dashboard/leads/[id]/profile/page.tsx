"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  GraduationCap,
  Award,
  Languages,
  Star,
  MessageSquare,
  Mail,
  Phone,
  Globe,
  MapPin,
  ExternalLink,
  Calendar,
  Building2,
  BadgeCheck,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatNumber, formatRelativeTime } from "@/lib/utils";
import { PLATFORM_COLORS } from "@lia360/shared";

// Collapsible Section Component
function CollapsibleSection({
  title,
  icon: Icon,
  children,
  count,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-50">
            <Icon className="h-5 w-5 text-indigo-600" />
          </div>
          <span className="font-semibold text-gray-900">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
              {count}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="p-4 pt-0 border-t">{children}</div>}
    </div>
  );
}

// Experience Timeline Item
function ExperienceItem({ exp }: { exp: any }) {
  return (
    <div className="flex gap-4 py-4 border-b last:border-0">
      {exp.companyLogo ? (
        <img
          src={exp.companyLogo}
          alt={exp.companyName}
          className="h-12 w-12 rounded-lg object-cover bg-gray-100"
        />
      ) : (
        <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
          <Building2 className="h-6 w-6 text-gray-400" />
        </div>
      )}
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900">{exp.roleTitle}</h4>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {exp.companyUrl ? (
            <a
              href={exp.companyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-600 hover:underline"
            >
              {exp.companyName}
            </a>
          ) : (
            <span>{exp.companyName}</span>
          )}
          {exp.employmentType && (
            <span className="text-gray-400">· {exp.employmentType}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
          <Calendar className="h-3 w-3" />
          <span>
            {exp.startDate || "N/A"} - {exp.endDate || "Atual"}
            {exp.duration && (
              <span className="text-gray-400"> · {exp.duration}</span>
            )}
          </span>
        </div>
        {exp.location && (
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
            <MapPin className="h-3 w-3" />
            <span>{exp.location}</span>
          </div>
        )}
        {exp.description && (
          <p className="text-sm text-gray-600 mt-2 line-clamp-3">
            {exp.description}
          </p>
        )}
      </div>
    </div>
  );
}

// Education Item
function EducationItem({ edu }: { edu: any }) {
  return (
    <div className="flex gap-4 py-4 border-b last:border-0">
      {edu.schoolLogo ? (
        <img
          src={edu.schoolLogo}
          alt={edu.school}
          className="h-12 w-12 rounded-lg object-cover bg-gray-100"
        />
      ) : (
        <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
          <GraduationCap className="h-6 w-6 text-gray-400" />
        </div>
      )}
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900">{edu.school}</h4>
        {(edu.degree || edu.fieldOfStudy) && (
          <p className="text-sm text-gray-600">
            {edu.degree}
            {edu.degree && edu.fieldOfStudy && ", "}
            {edu.fieldOfStudy}
          </p>
        )}
        {(edu.startDate || edu.endDate) && (
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
            <Calendar className="h-3 w-3" />
            <span>
              {edu.startDate || "N/A"} - {edu.endDate || "N/A"}
            </span>
          </div>
        )}
        {edu.grade && (
          <p className="text-xs text-gray-500 mt-1">Nota: {edu.grade}</p>
        )}
      </div>
    </div>
  );
}

// Skill Badge
function SkillBadge({ skill }: { skill: any }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border">
      <span className="text-sm font-medium text-gray-900">{skill.name}</span>
      {skill.endorsementsCount > 0 && (
        <span className="text-xs text-gray-500">
          · {skill.endorsementsCount} endorsements
        </span>
      )}
    </div>
  );
}

// Certification Item
function CertificationItem({ cert }: { cert: any }) {
  return (
    <div className="flex gap-3 py-3 border-b last:border-0">
      {cert.issuerLogo ? (
        <img
          src={cert.issuerLogo}
          alt={cert.issuer}
          className="h-10 w-10 rounded object-cover bg-gray-100"
        />
      ) : (
        <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
          <Award className="h-5 w-5 text-gray-400" />
        </div>
      )}
      <div className="flex-1">
        <h4 className="font-medium text-gray-900 text-sm">{cert.name}</h4>
        {cert.issuer && <p className="text-xs text-gray-600">{cert.issuer}</p>}
        {cert.issueDate && (
          <p className="text-xs text-gray-500 mt-0.5">
            Emitido em {cert.issueDate}
          </p>
        )}
        {cert.credentialUrl && (
          <a
            href={cert.credentialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-1"
          >
            Ver credencial <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

// Post Item
function PostItem({ post }: { post: any }) {
  return (
    <div className="py-4 border-b last:border-0">
      {post.content && (
        <p className="text-sm text-gray-700 line-clamp-4 mb-2">
          {post.content}
        </p>
      )}
      {post.imageUrls?.length > 0 && (
        <div className="flex gap-2 mb-2">
          {post.imageUrls.slice(0, 3).map((url: string, i: number) => (
            <img
              key={i}
              src={url}
              alt="Post"
              className="h-20 w-20 rounded object-cover bg-gray-100"
            />
          ))}
        </div>
      )}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {post.date && <span>{post.date}</span>}
        {post.likes !== null && <span>👍 {post.likes}</span>}
        {post.comments !== null && <span>💬 {post.comments}</span>}
        {post.postUrl && (
          <a
            href={post.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline inline-flex items-center gap-1"
          >
            Ver post <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

export default function LeadProfilePage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  const {
    data: lead,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["lead", leadId, "full"],
    queryFn: () => api.getLead(leadId) as any,
    enabled: !!leadId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-500">Lead não encontrado</p>
        <Button onClick={() => router.back()}>Voltar</Button>
      </div>
    );
  }

  const isEnriched = lead.enrichmentStatus && lead.enrichmentStatus !== "none";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">
                Perfil do Lead
              </h1>
              <p className="text-sm text-gray-500">Visualização completa</p>
            </div>
            {isEnriched && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                <Sparkles className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">
                  Perfil Enriquecido
                </span>
                {lead.enrichedAt && (
                  <span className="text-xs text-green-600">
                    · {formatRelativeTime(lead.enrichedAt)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Profile Card */}
        <Card className="p-6">
          <div className="flex items-start gap-6">
            <Avatar
              src={lead.avatarUrl}
              fallback={lead.fullName || lead.username}
              size="lg"
              className="h-24 w-24"
            />
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">
                  {lead.fullName || lead.username || "Sem nome"}
                </h2>
                {lead.verified && (
                  <BadgeCheck className="h-6 w-6 text-blue-500" />
                )}
              </div>
              {lead.headline && (
                <p className="text-gray-600 mt-1">{lead.headline}</p>
              )}
              {lead.company && (
                <p className="text-sm text-gray-500 mt-1">
                  <Building2 className="h-4 w-4 inline mr-1" />
                  {lead.company}
                  {lead.industry && ` · ${lead.industry}`}
                </p>
              )}
              {lead.location && (
                <p className="text-sm text-gray-500 mt-1">
                  <MapPin className="h-4 w-4 inline mr-1" />
                  {lead.location}
                </p>
              )}
              {lead.bio && (
                <p className="text-sm text-gray-600 mt-3 line-clamp-3">
                  {lead.bio}
                </p>
              )}

              {/* Social links */}
              {lead.socialProfiles?.length > 0 && (
                <div className="flex gap-2 mt-4">
                  {lead.socialProfiles.map((profile: any) => (
                    <a
                      key={profile.id}
                      href={profile.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor:
                          (PLATFORM_COLORS[profile.platform] || "#6366F1") +
                          "20",
                        color: PLATFORM_COLORS[profile.platform] || "#6366F1",
                      }}
                    >
                      {profile.platform}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Score */}
            <div className="text-center">
              <div className="text-4xl font-bold text-indigo-600">
                {lead.score}
              </div>
              <div className="text-sm text-gray-500">Score</div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">
                {formatNumber(lead.followersCount || lead.connectionCount || 0)}
              </div>
              <div className="text-sm text-gray-500">
                {lead.platform === "linkedin" ? "Conexões" : "Seguidores"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">
                {formatNumber(lead.followingCount || 0)}
              </div>
              <div className="text-sm text-gray-500">Seguindo</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">
                {formatNumber(lead.postsCount || 0)}
              </div>
              <div className="text-sm text-gray-500">Posts</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">
                {lead.skills?.length || 0}
              </div>
              <div className="text-sm text-gray-500">Skills</div>
            </div>
          </div>
        </Card>

        {/* Contact Info from enrichment */}
        {lead.contactInfo && (
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Mail className="h-5 w-5 text-gray-400" />
              Informações de Contato
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {lead.contactInfo.email && (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <a
                    href={`mailto:${lead.contactInfo.email}`}
                    className="text-sm text-indigo-600 hover:underline truncate"
                  >
                    {lead.contactInfo.email}
                  </a>
                </div>
              )}
              {lead.contactInfo.phone && (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <a
                    href={`tel:${lead.contactInfo.phone}`}
                    className="text-sm text-indigo-600 hover:underline truncate"
                  >
                    {lead.contactInfo.phone}
                  </a>
                </div>
              )}
              {lead.contactInfo.website && (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <Globe className="h-4 w-4 text-gray-400" />
                  <a
                    href={lead.contactInfo.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 hover:underline truncate"
                  >
                    {lead.contactInfo.website}
                  </a>
                </div>
              )}
              {lead.contactInfo.twitter && (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <span className="text-gray-400">𝕏</span>
                  <a
                    href={lead.contactInfo.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 hover:underline truncate"
                  >
                    Twitter
                  </a>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Experiences */}
        {lead.experiences?.length > 0 && (
          <CollapsibleSection
            title="Experiência Profissional"
            icon={Briefcase}
            count={lead.experiences.length}
          >
            <div className="divide-y">
              {lead.experiences.map((exp: any, i: number) => (
                <ExperienceItem key={exp.id || i} exp={exp} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Education */}
        {lead.educations?.length > 0 && (
          <CollapsibleSection
            title="Formação Acadêmica"
            icon={GraduationCap}
            count={lead.educations.length}
          >
            <div className="divide-y">
              {lead.educations.map((edu: any, i: number) => (
                <EducationItem key={edu.id || i} edu={edu} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Skills */}
        {lead.skills?.length > 0 && (
          <CollapsibleSection
            title="Competências"
            icon={Star}
            count={lead.skills.length}
          >
            <div className="flex flex-wrap gap-2">
              {lead.skills.map((skill: any, i: number) => (
                <SkillBadge key={skill.id || i} skill={skill} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Certifications */}
        {lead.certifications?.length > 0 && (
          <CollapsibleSection
            title="Certificações"
            icon={Award}
            count={lead.certifications.length}
          >
            <div className="divide-y">
              {lead.certifications.map((cert: any, i: number) => (
                <CertificationItem key={cert.id || i} cert={cert} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Languages */}
        {lead.languages?.length > 0 && (
          <CollapsibleSection
            title="Idiomas"
            icon={Languages}
            count={lead.languages.length}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {lead.languages.map((lang: any, i: number) => (
                <div
                  key={lang.id || i}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="font-medium text-gray-900">{lang.name}</span>
                  {lang.proficiency && (
                    <span className="text-xs text-gray-500">
                      {lang.proficiency}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Recommendations */}
        {lead.recommendations?.length > 0 && (
          <CollapsibleSection
            title="Recomendações"
            icon={MessageSquare}
            count={lead.recommendations.length}
            defaultOpen={false}
          >
            <div className="space-y-4">
              {lead.recommendations.map((rec: any, i: number) => (
                <div key={rec.id || i} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    {rec.authorAvatar ? (
                      <img
                        src={rec.authorAvatar}
                        alt={rec.authorName}
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-500 font-medium">
                          {rec.authorName?.[0]}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">
                        {rec.authorName}
                      </p>
                      {rec.authorHeadline && (
                        <p className="text-xs text-gray-500">
                          {rec.authorHeadline}
                        </p>
                      )}
                    </div>
                  </div>
                  {rec.text && (
                    <p className="text-sm text-gray-600 italic">"{rec.text}"</p>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Posts/Activity */}
        {lead.leadPosts?.length > 0 && (
          <CollapsibleSection
            title="Atividade Recente"
            icon={MessageSquare}
            count={lead.leadPosts.length}
            defaultOpen={false}
          >
            <div className="divide-y">
              {lead.leadPosts.map((post: any, i: number) => (
                <PostItem key={post.id || i} post={post} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Behavioral Analysis (existing) */}
        {lead.behavior && (
          <Card className="p-5 bg-indigo-50 border-indigo-100">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-indigo-100 rounded-lg">
                <span className="text-lg">🧠</span>
              </div>
              <h3 className="text-base font-semibold text-indigo-900">
                Análise Comportamental AI
              </h3>
              {lead.behavior.confidenceScore > 0 && (
                <span className="ml-auto text-xs font-medium text-indigo-600 bg-white px-2 py-1 rounded-full border border-indigo-200">
                  Confiança: {lead.behavior.confidenceScore}%
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white p-3 rounded-lg border border-indigo-100">
                <div className="text-xs text-gray-500 mb-0.5">Estado Civil</div>
                <div className="font-medium text-gray-900">
                  {lead.behavior.maritalStatus === "married"
                    ? "Casado(a)"
                    : lead.behavior.maritalStatus === "single"
                      ? "Solteiro(a)"
                      : "Desconhecido"}
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-indigo-100">
                <div className="text-xs text-gray-500 mb-0.5">Filhos</div>
                <div className="font-medium text-gray-900">
                  {lead.behavior.hasChildren ? "Sim" : "Não identificado"}
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-indigo-100">
                <div className="text-xs text-gray-500 mb-0.5">Dispositivo</div>
                <div className="font-medium text-gray-900 capitalize">
                  {lead.behavior.deviceType || "Desconhecido"}
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-indigo-100">
                <div className="text-xs text-gray-500 mb-0.5">
                  Intenção de Compra
                </div>
                <div
                  className={`font-medium ${
                    lead.behavior.buyingIntent === "High"
                      ? "text-green-600"
                      : lead.behavior.buyingIntent === "Medium"
                        ? "text-yellow-600"
                        : "text-gray-600"
                  }`}
                >
                  {lead.behavior.buyingIntent === "High"
                    ? "Alta"
                    : lead.behavior.buyingIntent === "Medium"
                      ? "Média"
                      : "Baixa"}
                </div>
              </div>
            </div>

            {lead.behavior.interests?.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-1.5">Interesses</div>
                <div className="flex flex-wrap gap-1.5">
                  {lead.behavior.interests.map(
                    (interest: string, i: number) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded-md bg-indigo-100 text-indigo-700 text-xs font-medium"
                      >
                        {interest}
                      </span>
                    ),
                  )}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Notes */}
        {lead.notes && (
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Notas</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {lead.notes}
            </p>
          </Card>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t">
          <span>Criado {formatRelativeTime(lead.createdAt)}</span>
          {lead.lastInteractionAt && (
            <span>
              Última interação {formatRelativeTime(lead.lastInteractionAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
