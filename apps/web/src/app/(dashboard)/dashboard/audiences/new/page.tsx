'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Plus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { countries, searchCountries } from '@/lib/countries';
import {
    SocialPlatforms
} from '@/components/ui/social-icons';
import { LabelWithTooltip } from '@/components/ui/label-with-tooltip';

interface AudienceFormData {
    name: string;
    gender: string[];
    ignoreGenderIfUnknown: boolean;
    countries: string[];
    ignoreCountryIfUnknown: boolean;
    excludePrivate: boolean;
    excludeNoMessage: boolean;
    excludeNoPhoto: boolean;
    excludeCompanyPages: boolean;
    verifiedFilter: 'any' | 'verified_only' | 'unverified_only';
    friendsMin: number | null;
    friendsMax: number | null;
    mutualFriendsMin: number | null;
    mutualFriendsMax: number | null;
    followersMin: number | null;
    followersMax: number | null;
    postsMin: number | null;
    postsMax: number | null;
    jobTitleInclude: string[];
    jobTitleExclude: string[];
    profileInfoInclude: string[];
    profileInfoExclude: string[];
    postContentInclude: string[];
    postContentExclude: string[];
}

const initialFormData: AudienceFormData = {
    name: '',
    gender: [],
    ignoreGenderIfUnknown: true,
    countries: [],
    ignoreCountryIfUnknown: true,
    excludePrivate: false,
    excludeNoMessage: false,
    excludeNoPhoto: false,
    excludeCompanyPages: false,
    verifiedFilter: 'any',
    friendsMin: null,
    friendsMax: null,
    mutualFriendsMin: null,
    mutualFriendsMax: null,
    followersMin: null,
    followersMax: null,
    postsMin: null,
    postsMax: null,
    jobTitleInclude: [],
    jobTitleExclude: [],
    profileInfoInclude: [],
    profileInfoExclude: [],
    postContentInclude: [],
    postContentExclude: [],
};

const STEPS = [
    { id: 1, title: 'Identificação', description: 'Nome da audiência' },
    { id: 2, title: 'Detalhes do Perfil', description: 'Gênero, países e filtros' },
    { id: 3, title: 'Atividade Social', description: 'Seguidores, amigos e posts' },
    { id: 4, title: 'Conteúdo Social', description: 'Keywords de interesse' },
];

export default function NewAudiencePage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState<AudienceFormData>(initialFormData);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [countrySearch, setCountrySearch] = useState('');
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);

    const [keywordInputs, setKeywordInputs] = useState({
        jobTitleInclude: '',
        jobTitleExclude: '',
        profileInfoInclude: '',
        profileInfoExclude: '',
        postContentInclude: '',
        postContentExclude: '',
    });

    const createMutation = useMutation({
        mutationFn: (data: AudienceFormData) => api.createAudience(data as any),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['audiences'] });
            router.push('/dashboard/audiences');
        },
        onError: (error: Error) => {
            setErrors({ submit: error.message });
        },
    });

    const validateStep = (step: number): boolean => {
        const newErrors: Record<string, string> = {};

        if (step === 1 && !formData.name.trim()) {
            newErrors.name = 'Nome é obrigatório';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            if (currentStep < 4) {
                setCurrentStep(currentStep + 1);
            } else {
                createMutation.mutate(formData);
            }
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        } else {
            router.back();
        }
    };

    const toggleGender = (gender: 'male' | 'female') => {
        setFormData(prev => ({
            ...prev,
            gender: prev.gender.includes(gender)
                ? prev.gender.filter(g => g !== gender)
                : [...prev.gender, gender]
        }));
    };

    const addCountry = (code: string) => {
        if (!formData.countries.includes(code)) {
            setFormData(prev => ({
                ...prev,
                countries: [...prev.countries, code]
            }));
        }
        setCountrySearch('');
        setShowCountryDropdown(false);
    };

    const removeCountry = (code: string) => {
        setFormData(prev => ({
            ...prev,
            countries: prev.countries.filter(c => c !== code)
        }));
    };

    const addKeyword = (field: keyof typeof keywordInputs) => {
        const value = keywordInputs[field].trim();
        if (!value) return;

        const arrayField = field as keyof Pick<AudienceFormData,
            'jobTitleInclude' | 'jobTitleExclude' |
            'profileInfoInclude' | 'profileInfoExclude' |
            'postContentInclude' | 'postContentExclude'>;

        if (!formData[arrayField].includes(value)) {
            setFormData(prev => ({
                ...prev,
                [arrayField]: [...prev[arrayField], value]
            }));
        }
        setKeywordInputs(prev => ({ ...prev, [field]: '' }));
    };

    const removeKeyword = (field: keyof AudienceFormData, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: (prev[field] as string[]).filter(k => k !== value)
        }));
    };

    const handleKeywordKeyDown = (e: React.KeyboardEvent, field: keyof typeof keywordInputs) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addKeyword(field);
        }
    };

    const filteredCountries = searchCountries(countrySearch).filter(
        c => !formData.countries.includes(c.code)
    );

    // Step Components
    const renderStep1 = () => (
        <div className="space-y-4">
            <div>
                <LabelWithTooltip tooltip="Nome interno para identificar esta audiência nos seus relatórios e listagens.">
                    Nome da Audiência *
                </LabelWithTooltip>
                <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Profissionais de Marketing no Brasil"
                    className={`text-sm ${errors.name ? 'border-red-500' : ''}`}
                />
                {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                )}
                <p className="text-gray-500 text-sm mt-2">
                    Escolha um nome descritivo que identifique facilmente esta audiência.
                </p>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6">
            {/* Gênero */}
            <div>
                <LabelWithTooltip tooltip="Selecione o gênero dos perfis que deseja incluir na busca.">
                    Gênero
                </LabelWithTooltip>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => toggleGender('male')}
                        className={`px-4 py-2 rounded-lg border transition-colors ${formData.gender.includes('male')
                            ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                            : 'border-gray-300 hover:border-gray-400'
                            }`}
                    >
                        Homem
                    </button>
                    <button
                        type="button"
                        onClick={() => toggleGender('female')}
                        className={`px-4 py-2 rounded-lg border transition-colors ${formData.gender.includes('female')
                            ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                            : 'border-gray-300 hover:border-gray-400'
                            }`}
                    >
                        Mulher
                    </button>
                </div>

                <SocialPlatforms />

                <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input
                        type="checkbox"
                        checked={formData.ignoreGenderIfUnknown}
                        onChange={(e) => setFormData(prev => ({ ...prev, ignoreGenderIfUnknown: e.target.checked }))}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-600">Ignorar essa opção caso não seja possível determinar o gênero</span>
                </label>
            </div>

            {/* Países */}
            <div>
                <LabelWithTooltip tooltip="Filtre perfis baseados na localização geográfica (País).">
                    Países
                </LabelWithTooltip>
                <div className="relative">
                    <Input
                        value={countrySearch}
                        onChange={(e) => {
                            setCountrySearch(e.target.value);
                            setShowCountryDropdown(true);
                        }}
                        onFocus={() => setShowCountryDropdown(true)}
                        placeholder="Buscar país..."
                    />
                    {showCountryDropdown && filteredCountries.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-auto">
                            {filteredCountries.slice(0, 10).map(country => (
                                <button
                                    key={country.code}
                                    type="button"
                                    onClick={() => addCountry(country.code)}
                                    className="w-full px-4 py-2 text-left hover:bg-gray-100"
                                >
                                    {country.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {formData.countries.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {formData.countries.map(code => {
                            const country = countries.find(c => c.code === code);
                            return (
                                <Badge key={code} variant="secondary" className="flex items-center gap-1">
                                    {country?.name}
                                    <button type="button" onClick={() => removeCountry(code)} className="hover:text-red-500">
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            );
                        })}
                    </div>
                )}
                <SocialPlatforms />
                <label className="flex items-center gap-2 cursor-pointer mt-3">
                    <input
                        type="checkbox"
                        checked={formData.ignoreCountryIfUnknown}
                        onChange={(e) => setFormData(prev => ({ ...prev, ignoreCountryIfUnknown: e.target.checked }))}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-600">Ignorar essa opção caso não possua essa informação</span>
                </label>
            </div>

            {/* Tipo de Perfil */}
            <div>
                <LabelWithTooltip tooltip="Defina critérios de exclusão para refinar a qualidade dos perfis encontrados.">
                    Tipo de Perfil
                </LabelWithTooltip>
                <div className="space-y-2">
                    {[
                        { key: 'excludePrivate', label: 'Excluir perfis privados' },
                        { key: 'excludeNoMessage', label: 'Excluir perfis sem botão de mensagem' },
                        { key: 'excludeNoPhoto', label: 'Excluir perfis sem foto' },
                        { key: 'excludeCompanyPages', label: 'Excluir páginas de empresas (Facebook)' },
                    ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData[key as keyof AudienceFormData] as boolean}
                                onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.checked }))}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700">{label}</span>
                        </label>
                    ))}
                </div>
                <SocialPlatforms visible={['facebook', 'linkedin', 'instagram', 'x']} />
            </div>

            {/* Perfil Verificado */}
            <div>
                <LabelWithTooltip tooltip="Filtre por status de verificação da conta (selo azul).">
                    Perfil Verificado
                </LabelWithTooltip>
                <div className="space-y-2">
                    {[
                        { value: 'any', label: 'Qualquer tipo' },
                        { value: 'verified_only', label: 'Somente verificados' },
                        { value: 'unverified_only', label: 'Somente não verificados' },
                    ].map(({ value, label }) => (
                        <label key={value} className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="verifiedFilter"
                                checked={formData.verifiedFilter === value}
                                onChange={() => setFormData(prev => ({ ...prev, verifiedFilter: value as AudienceFormData['verifiedFilter'] }))}
                                className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700">{label}</span>
                        </label>
                    ))}
                </div>
                <SocialPlatforms visible={['facebook', 'linkedin', 'instagram', 'x', 'tiktok']} />
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <LabelWithTooltip tooltip="Defina o intervalo de conexões ou amigos que o perfil deve ter.">
                    Amigos/Conexões
                </LabelWithTooltip>
                <div className="flex gap-2">
                    <Input
                        type="number"
                        placeholder="Mín"
                        value={formData.friendsMin ?? ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, friendsMin: e.target.value ? parseInt(e.target.value) : null }))}
                    />
                    <Input
                        type="number"
                        placeholder="Máx"
                        value={formData.friendsMax ?? ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, friendsMax: e.target.value ? parseInt(e.target.value) : null }))}
                    />
                </div>
                <SocialPlatforms visible={['facebook', 'linkedin']} />
            </div>

            <div>
                <LabelWithTooltip tooltip="Filtre perfis com base no número de amigos em comum com a conta utilizada para busca.">
                    Amigos em Comum
                </LabelWithTooltip>
                <div className="flex gap-2">
                    <Input
                        type="number"
                        placeholder="Mín"
                        value={formData.mutualFriendsMin ?? ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, mutualFriendsMin: e.target.value ? parseInt(e.target.value) : null }))}
                    />
                    <Input
                        type="number"
                        placeholder="Máx"
                        value={formData.mutualFriendsMax ?? ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, mutualFriendsMax: e.target.value ? parseInt(e.target.value) : null }))}
                    />
                </div>
                <SocialPlatforms visible={['facebook']} />
            </div>

            <div>
                <LabelWithTooltip tooltip="Defina o intervalo de seguidores que o perfil deve possuir.">
                    Seguidores
                </LabelWithTooltip>
                <div className="flex gap-2">
                    <Input
                        type="number"
                        placeholder="Mín"
                        value={formData.followersMin ?? ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, followersMin: e.target.value ? parseInt(e.target.value) : null }))}
                    />
                    <Input
                        type="number"
                        placeholder="Máx"
                        value={formData.followersMax ?? ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, followersMax: e.target.value ? parseInt(e.target.value) : null }))}
                    />
                </div>
                <SocialPlatforms visible={['facebook', 'linkedin', 'instagram', 'x', 'tiktok', 'sk']} />
            </div>

            <div>
                <LabelWithTooltip tooltip="Filtre perfis pela quantidade de posts recentes (atividade).">
                    Posts Recentes
                </LabelWithTooltip>
                <div className="flex gap-2">
                    <Input
                        type="number"
                        placeholder="Mín"
                        value={formData.postsMin ?? ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, postsMin: e.target.value ? parseInt(e.target.value) : null }))}
                    />
                    <Input
                        type="number"
                        placeholder="Máx"
                        value={formData.postsMax ?? ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, postsMax: e.target.value ? parseInt(e.target.value) : null }))}
                    />
                </div>
                <SocialPlatforms visible={['facebook', 'linkedin', 'instagram', 'x', 'tiktok', 'sk']} />
            </div>
        </div>
    );

    const renderKeywordField = (
        label: string,
        includeField: keyof typeof keywordInputs,
        excludeField: keyof typeof keywordInputs,
        visibleIcons?: string[],
        tooltipText?: string
    ) => (
        <div className="mb-6">
            <LabelWithTooltip tooltip={tooltipText || "Adicione palavras-chave para incluir ou excluir perfis."}>
                {label}
            </LabelWithTooltip>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <p className="text-xs text-gray-500 mb-1">Incluir</p>
                    <div className="flex gap-2">
                        <Input
                            value={keywordInputs[includeField]}
                            onChange={(e) => setKeywordInputs(prev => ({ ...prev, [includeField]: e.target.value }))}
                            onKeyDown={(e) => handleKeywordKeyDown(e, includeField)}
                            placeholder="Adicionar keyword..."
                        />
                        <Button type="button" variant="outline" size="sm" onClick={() => addKeyword(includeField)}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                        {formData[includeField.replace('Include', 'Include') as keyof AudienceFormData] &&
                            (formData[includeField as keyof AudienceFormData] as string[]).map(kw => (
                                <Badge key={kw} className="bg-green-100 text-green-700">
                                    {kw}
                                    <button type="button" onClick={() => removeKeyword(includeField as keyof AudienceFormData, kw)} className="ml-1">
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                    </div>
                </div>
                <div>
                    <p className="text-xs text-gray-500 mb-1">Excluir</p>
                    <div className="flex gap-2">
                        <Input
                            value={keywordInputs[excludeField]}
                            onChange={(e) => setKeywordInputs(prev => ({ ...prev, [excludeField]: e.target.value }))}
                            onKeyDown={(e) => handleKeywordKeyDown(e, excludeField)}
                            placeholder="Adicionar keyword..."
                        />
                        <Button type="button" variant="outline" size="sm" onClick={() => addKeyword(excludeField)}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                        {(formData[excludeField as keyof AudienceFormData] as string[]).map(kw => (
                            <Badge key={kw} className="bg-red-100 text-red-700">
                                {kw}
                                <button type="button" onClick={() => removeKeyword(excludeField as keyof AudienceFormData, kw)} className="ml-1">
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                </div>
            </div>
            {visibleIcons && <SocialPlatforms visible={visibleIcons} />}
        </div>
    );

    const renderStep4 = () => (
        <div className="space-y-6">
            {renderKeywordField(
                'Palavras-chave de Cargo',
                'jobTitleInclude',
                'jobTitleExclude',
                ['facebook', 'linkedin'],
                'Filtre perfis com base em cargos específicos atuais ou passados.'
            )}
            {renderKeywordField(
                'Palavras-chave de Informações do Perfil',
                'profileInfoInclude',
                'profileInfoExclude',
                ['facebook', 'linkedin', 'instagram', 'x', 'tiktok', 'sk'],
                'Busque palavras-chave na biografia, "sobre" ou descrição do perfil.'
            )}
            {renderKeywordField(
                'Palavras-chave de Conteúdo do Post',
                'postContentInclude',
                'postContentExclude',
                ['facebook', 'linkedin', 'instagram', 'x', 'tiktok'],
                'Filtre perfis que publicaram conteúdo contendo estas palavras-chave.'
            )}
        </div>
    );

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 1: return renderStep1();
            case 2: return renderStep2();
            case 3: return renderStep3();
            case 4: return renderStep4();
            default: return null;
        }
    };

    return (
        <div className="w-full">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Nova Audiência</h1>
                <p className="text-gray-600">Defina os critérios de segmentação para mineração de leads</p>
            </div>

            {/* Step Content */}
            <Card className="p-6 mb-6 min-h-[300px]">
                {/* Step Indicator */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        {STEPS.map((step, index) => (
                            <div key={step.id} className={`flex items-center ${index === STEPS.length - 1 ? '' : 'flex-1'}`}>
                                <div className="flex flex-col items-center">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${currentStep > step.id
                                            ? 'bg-green-500 text-white'
                                            : currentStep === step.id
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-200 text-gray-500'
                                            }`}
                                    >
                                        {currentStep > step.id ? <Check className="h-5 w-5" /> : step.id}
                                    </div>
                                    <div className="mt-2 text-center">
                                        <p className={`text-sm font-medium ${currentStep === step.id ? 'text-indigo-600' : 'text-gray-500'}`}>
                                            {step.title}
                                        </p>
                                        <p className="text-xs text-gray-400 hidden md:block">{step.description}</p>
                                    </div>
                                </div>
                                {index < STEPS.length - 1 && (
                                    <div
                                        className={`flex-1 h-1 mx-4 rounded ${currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                                            }`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {renderCurrentStep()}
            </Card>

            {/* Error Message */}
            {errors.submit && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {errors.submit}
                </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {currentStep === 1 ? 'Cancelar' : 'Voltar'}
                </Button>
                <Button onClick={handleNext} disabled={createMutation.isPending}>
                    {currentStep === 4 ? (
                        createMutation.isPending ? 'Criando...' : 'Criar Audiência'
                    ) : (
                        <>
                            Próximo
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
