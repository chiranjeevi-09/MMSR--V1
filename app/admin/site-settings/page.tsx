'use client';

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  GraduationCap,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  BookOpen,
  Newspaper,
  Users,
  Award,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';
import {
  getImpactMetrics,
  saveImpactMetrics,
  getUniversityPartners,
  saveUniversityPartners,
  ImpactMetricsConfig,
  UniversityPartnerConfig,
  DEFAULT_METRICS,
} from '@/lib/services/siteSettings';

export default function AdminSiteSettingsPage() {
  const [metrics, setMetrics] = useState<ImpactMetricsConfig>(DEFAULT_METRICS);

  const [partners, setPartners] = useState<UniversityPartnerConfig[]>([]);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // New partner input fields
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerLocation, setNewPartnerLocation] = useState('');
  const [newPartnerType, setNewPartnerType] = useState('');
  const [partnerError, setPartnerError] = useState('');
  const [partnerSuccess, setPartnerSuccess] = useState('');

  useEffect(() => {
    setMetrics(getImpactMetrics());
    setPartners(getUniversityPartners());
  }, []);

  const handleSaveMetrics = (e: React.FormEvent) => {
    e.preventDefault();
    saveImpactMetrics(metrics);
    saveUniversityPartners(partners);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleAddPartner = (e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPartnerName.trim()) {
      setPartnerError('Please enter a College / University Name.');
      return;
    }
    setPartnerError('');
    const newP: UniversityPartnerConfig = {
      id: `uni-${Date.now()}`,
      name: newPartnerName.trim(),
      location: newPartnerLocation.trim() || 'Global',
      type: newPartnerType.trim() || 'Academic Partner',
    };
    const updated = [newP, ...partners];
    setPartners(updated);
    saveUniversityPartners(updated);
    setNewPartnerName('');
    setNewPartnerLocation('');
    setNewPartnerType('');
    setPartnerSuccess(`"${newP.name}" added successfully to university partners!`);
    setTimeout(() => setPartnerSuccess(''), 3500);
  };

  const handleRemovePartner = (id: string) => {
    const updated = partners.filter((p) => p.id !== id);
    setPartners(updated);
    saveUniversityPartners(updated);
  };

  // Metric fields grouped per public page so each page's content is managed
  // in its own separate card instead of one combined block.
  type MetricField = {
    key: keyof ImpactMetricsConfig;
    label: string;
    type: 'number' | 'text';
    hint: string;
  };
  const metricGroups: {
    id: string;
    title: string;
    description: string;
    saveLabel: string;
    icon: React.ReactNode;
    fields: MetricField[];
  }[] = [
    {
      id: 'home',
      title: 'Impact Metrics & Statistics (Landing & Home Page)',
      description: 'Configure the exact numeric values displayed in the Landing Page 2nd section and Home Page Trust section.',
      saveLabel: 'Save Home Metrics',
      icon: <Sliders className="w-5 h-5" />,
      fields: [
        { key: 'booksCount', label: 'Books Published', type: 'number', hint: `Renders as ${metrics.booksCount}+ Books` },
        { key: 'journalsCount', label: 'Active Peer-Reviewed Journals', type: 'number', hint: `Renders as ${metrics.journalsCount}+ Journals` },
        { key: 'authorsCount', label: 'International Authors', type: 'number', hint: `Renders as ${metrics.authorsCount.toLocaleString()}+ Authors` },
        { key: 'satisfactionRate', label: 'Publication Satisfaction Rating', type: 'text', hint: `Renders as ${metrics.satisfactionRate} Approval` },
        { key: 'publishedArticles', label: 'Published Articles / Manuscripts', type: 'number', hint: `Renders as ${metrics.publishedArticles.toLocaleString()}+ Articles` },
        { key: 'partnerUnisCount', label: 'Partner Universities', type: 'number', hint: `Renders as ${metrics.partnerUnisCount}+ Universities` },
        { key: 'countriesCount', label: 'Countries Reached', type: 'number', hint: `Renders as ${metrics.countriesCount}+ Countries` },
        { key: 'certificatesCount', label: 'Certificates Issued', type: 'number', hint: `Renders as ${metrics.certificatesCount.toLocaleString()}+ Certificates` },
      ],
    },
    {
      id: 'books',
      title: 'Books Page Hero Metrics',
      description: 'Values shown in the hero strip of the public Books page.',
      saveLabel: 'Save Books Metrics',
      icon: <BookOpen className="w-5 h-5" />,
      fields: [
        { key: 'editedBooksText', label: 'Total Edited Books', type: 'text', hint: `Renders on Books Hero as ${metrics.editedBooksText || '500+'}` },
        { key: 'peerReviewStandard', label: 'Peer Review Standard', type: 'text', hint: `Renders on Books Hero as ${metrics.peerReviewStandard || 'Double-Blind'}` },
        { key: 'digitalObjectId', label: 'Digital Object ID', type: 'text', hint: `Renders on Books Hero as ${metrics.digitalObjectId || 'Crossref Registered'}` },
      ],
    },
    {
      id: 'journals',
      title: 'Journals Page Hero Metrics',
      description: 'Values shown in the hero strip of the public Journals page.',
      saveLabel: 'Save Journals Metrics',
      icon: <Newspaper className="w-5 h-5" />,
      fields: [
        { key: 'activeJournalsText', label: 'Active Journals', type: 'text', hint: `Renders on Journals Hero as ${metrics.activeJournalsText || '50+'}` },
        { key: 'disciplinesText', label: 'Disciplines Count', type: 'text', hint: `Renders on Journals Hero as ${metrics.disciplinesText || '12+'}` },
        { key: 'issuesPublishedText', label: 'Issues Published', type: 'text', hint: `Renders on Journals Hero as ${metrics.issuesPublishedText || '500+'}` },
        { key: 'countriesText', label: 'Countries Count', type: 'text', hint: `Renders on Journals Hero as ${metrics.countriesText || '50+'}` },
      ],
    },
    {
      id: 'conferences',
      title: 'Conferences Page Hero Metrics',
      description: 'Values shown in the hero strip of the public Conference page.',
      saveLabel: 'Save Conference Metrics',
      icon: <Users className="w-5 h-5" />,
      fields: [
        { key: 'confHostedText', label: 'Conferences Hosted', type: 'text', hint: `Renders on Conference Hero as ${metrics.confHostedText || '25+'}` },
        { key: 'confDomainsText', label: 'Research Domains', type: 'text', hint: `Renders on Conference Hero as ${metrics.confDomainsText || '10+'}` },
        { key: 'confPapersText', label: 'Papers Published', type: 'text', hint: `Renders on Conference Hero as ${metrics.confPapersText || '2,000+'}` },
        { key: 'confCountriesText', label: 'Countries Represented', type: 'text', hint: `Renders on Conference Hero as ${metrics.confCountriesText || '40+'}` },
      ],
    },
    {
      id: 'services',
      title: 'Publishing Services Page Hero Metrics',
      description: 'Values shown in the hero strip of the public Services page.',
      saveLabel: 'Save Services Metrics',
      icon: <Globe className="w-5 h-5" />,
      fields: [
        { key: 'servicesTotalText', label: 'Total Services', type: 'text', hint: `Renders on Services Hero as ${metrics.servicesTotalText || '12+'}` },
        { key: 'servicesWorksText', label: 'Published Works', type: 'text', hint: `Renders on Services Hero as ${metrics.servicesWorksText || '500+'}` },
        { key: 'servicesReviewText', label: 'Peer Review Standard', type: 'text', hint: `Renders on Services Hero as ${metrics.servicesReviewText || 'Double-Blind'}` },
        { key: 'servicesIdText', label: 'Identifier System', type: 'text', hint: `Renders on Services Hero as ${metrics.servicesIdText || 'Crossref DOI'}` },
      ],
    },
  ];

  return (
    <AdminLayout
      title="Dynamic Site Content & Impact Metrics"
      subtitle="Control dynamic numeric values on Landing Page, Home Page, and manage University Academic Alliances."
    >
      <form onSubmit={handleSaveMetrics} className="space-y-8 font-manrope">
        {savedSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Site Dynamic Metrics and Academic Alliances successfully saved and updated live!</span>
          </div>
        )}

        {/* Section 1: Per-page metric cards — Home/Landing, Books, Journals, Conferences, Services */}
        {metricGroups.map((group) => (
          <div key={group.id} className="p-7 rounded-3xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-[#D4AC54] pb-4 gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gold-500/15 border border-[#D4AC54] text-[#C99A2E]">
                  {group.icon}
                </div>
                <div>
                  <h3 className="text-lg font-bold font-playfair text-[#2F241A]">{group.title}</h3>
                  <p className="text-xs text-[#73614C]">{group.description}</p>
                </div>
              </div>

              <Button
                type="submit"
                variant="gold"
                size="sm"
                leftIcon={<Save className="w-4 h-4" />}
              >
                {group.saveLabel}
              </Button>
            </div>

            {/* Equal-height metric cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {group.fields.map((field) => (
                <div
                  key={field.key}
                  className="flex flex-col gap-1.5 p-4 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]"
                >
                  <label className="block text-[13px] font-bold text-[#73614C] uppercase tracking-wide">
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    value={metrics[field.key] as string | number}
                    onChange={(e) =>
                      setMetrics({
                        ...metrics,
                        [field.key]:
                          field.type === 'number'
                            ? parseInt(e.target.value) || 0
                            : e.target.value,
                      })
                    }
                    className="w-full bg-[#FFF9F1] border border-[#D4AC54] rounded-xl px-4 py-2.5 text-sm text-[#2F241A] font-bold outline-none focus:border-[#C99A2E] transition-colors"
                  />
                  <span className="text-[13px] text-[#73614C] mt-auto">{field.hint}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Section 2: Academic Alliances (University & Institutional Partners) */}
        <div className="p-7 rounded-3xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-[#D4AC54] pb-4">
            <div className="p-2.5 rounded-xl bg-gold-500/15 border border-[#D4AC54] text-[#C99A2E]">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-playfair text-[#2F241A]">
                Academic Alliances &amp; University Partners (9th Section)
              </h3>
              <p className="text-xs text-[#73614C]">
                Add, edit, or remove partner universities/colleges dynamically displayed on the Home Page marquee.
              </p>
            </div>
          </div>

          {/* Add New Partner Form */}
          <div className="p-5 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]">
            <p className="text-[13px] font-bold text-[#73614C] uppercase tracking-wide mb-3">Add New University Partner</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[13px] font-semibold text-[#73614C] mb-1">
                  College / University Name *
                </label>
                <input
                  type="text"
                  value={newPartnerName}
                  onChange={(e) => {
                    setNewPartnerName(e.target.value);
                    if (partnerError) setPartnerError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPartner();
                    }
                  }}
                  placeholder="e.g. Oxford Academic Network"
                  className="w-full bg-[#FFF9F1] border border-[#D4AC54] rounded-xl px-3.5 py-2.5 text-xs text-[#2F241A] outline-none focus:border-[#C99A2E] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#73614C] mb-1">
                  Alliance Category / Type
                </label>
                <input
                  type="text"
                  value={newPartnerType}
                  onChange={(e) => setNewPartnerType(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPartner();
                    }
                  }}
                  placeholder="e.g. Global Research Partner"
                  className="w-full bg-[#FFF9F1] border border-[#D4AC54] rounded-xl px-3.5 py-2.5 text-xs text-[#2F241A] outline-none focus:border-[#C99A2E] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#73614C] mb-1">
                  Country / Location
                </label>
                <input
                  type="text"
                  value={newPartnerLocation}
                  onChange={(e) => setNewPartnerLocation(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPartner();
                    }
                  }}
                  placeholder="e.g. United Kingdom"
                  className="w-full bg-[#FFF9F1] border border-[#D4AC54] rounded-xl px-3.5 py-2.5 text-xs text-[#2F241A] outline-none focus:border-[#C99A2E] transition-colors"
                />
              </div>
            </div>

            {partnerError && (
              <p className="text-xs text-red-600 font-semibold mt-2 font-manrope animate-fade-in">
                ⚠️ {partnerError}
              </p>
            )}

            {partnerSuccess && (
              <p className="text-xs text-emerald-700 font-semibold mt-2 font-manrope animate-fade-in">
                ✓ {partnerSuccess}
              </p>
            )}

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="gold"
                size="sm"
                onClick={handleAddPartner}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add University
              </Button>
            </div>
          </div>

          {/* Existing Partners List */}
          {partners.length === 0 ? (
            <div className="text-center py-8 text-[#73614C] text-sm">
              No university partners added yet. Use the form above to add partners.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {partners.map((partner) => (
                <div
                  key={partner.id}
                  className="p-4 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54] flex items-start gap-3"
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-[#C99A2E]/10 border border-[#D4AC54] flex items-center justify-center text-[#C99A2E] shrink-0 mt-0.5">
                    <GraduationCap className="w-5 h-5" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold font-playfair text-[#2F241A] truncate">{partner.name}</h5>
                    <span className="text-[13px] text-[#C99A2E] font-semibold block truncate">{partner.type}</span>
                    <span className="text-[13px] text-[#73614C] block">{partner.location}</span>
                  </div>

                  {/* Delete Button — always visible, aligned top-right */}
                  <button
                    type="button"
                    onClick={() => handleRemovePartner(partner.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-500/10 transition-all shrink-0 mt-0.5"
                    title="Remove university partner"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-[#D4AC54]">
          <Button
            type="submit"
            variant="gold"
            size="md"
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save All Changes
          </Button>
        </div>
      </form>
    </AdminLayout>
  );
}
