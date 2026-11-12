'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Check,
  Save,
  Shield,
  Mail,
  Info,
  FileText,
  CheckCircle2,
  Package,
  Receipt,
  Newspaper,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/Button';

interface NotificationPreferences {
  submissionUpdates: boolean;
  reviewDecisions: boolean;
  publicationAlerts: boolean;
  orderUpdates: boolean;
  invoiceEmails: boolean;
  newsletter: boolean;
  conferenceAnnouncements: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  submissionUpdates: true,
  reviewDecisions: true,
  publicationAlerts: true,
  orderUpdates: true,
  invoiceEmails: true,
  newsletter: false,
  conferenceAnnouncements: true,
};

const STORAGE_KEY = 'mmsr_v2_notification_preferences';

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setPrefs(JSON.parse(saved));
      }
    } catch {
      // fallback to default
    }
  }, []);

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setIsSaved(false);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      } catch {
        // ignore
      }
      setSaving(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }, 400);
  };

  const preferenceItems: {
    key: keyof NotificationPreferences;
    title: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: 'submissionUpdates',
      title: 'Submission Updates',
      description: 'Receive real-time email notifications when your manuscript advances through screening, peer review, and editorial stages.',
      icon: <FileText className="w-5 h-5 text-amber-400" />,
    },
    {
      key: 'reviewDecisions',
      title: 'Review Decisions',
      description: 'Instant notification of peer review reports, major/minor revision requests, acceptance letters, and rejection decisions.',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    },
    {
      key: 'publicationAlerts',
      title: 'Publication Alerts',
      description: 'Get notified when your accepted manuscript is assigned a DOI, galley proof, and published online in MMSR volumes.',
      icon: <Sparkles className="w-5 h-5 text-gold-400" />,
    },
    {
      key: 'orderUpdates',
      title: 'Order & Shipping Updates',
      description: 'Tracking updates for physical book shipments, institutional print journal orders, and dispatch confirmations.',
      icon: <Package className="w-5 h-5 text-purple-400" />,
    },
    {
      key: 'invoiceEmails',
      title: 'Invoice & Payment Receipts',
      description: 'Automated tax compliant invoices, GST receipts, and transaction records emailed upon order verification.',
      icon: <Receipt className="w-5 h-5 text-sky-400" />,
    },
    {
      key: 'newsletter',
      title: 'Research Digest & Newsletter',
      description: 'Monthly curations of high-impact open access research papers, call for papers, and editorial spotlights.',
      icon: <Newspaper className="w-5 h-5 text-blue-400" />,
    },
    {
      key: 'conferenceAnnouncements',
      title: 'Conference & Symposium Alerts',
      description: 'Invitations to international academic conferences, proceedings submission deadlines, and speaker calls.',
      icon: <Calendar className="w-5 h-5 text-[#DC2626]" />,
    },
  ];

  return (
    <DashboardLayout
      title="Notification Preferences"
      subtitle="Manage your email subscription preferences and alert settings"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="p-6 rounded-2xl bg-navy-950/80 border border-[#D4AC54] backdrop-blur-md space-y-2">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-[#D4AC54] flex items-center justify-center text-gold-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-[#2F241A] tracking-wide">Email Communication Preferences</h1>
              <p className="text-xs text-text-muted">
                Configure which email alerts, editorial decisions, and publication dispatches you receive.
              </p>
            </div>
          </div>
        </div>

        {/* Backend Info Notice Banner */}
        <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs flex items-start gap-3">
          <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-[#2F241A]">Informational Synchronization Notice</p>
            <p className="text-[13px] text-sky-200/80 leading-relaxed">
              Email preference synchronization with backend server will take effect upon backend email module deployment. Your preferences below are saved locally in your author session.
            </p>
          </div>
        </div>

        {/* Preference Switches Grid */}
        <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
          <div className="flex items-center justify-between border-b border-[#D4AC54]/60 pb-3">
            <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
              <Bell className="w-4 h-4" /> Email Dispatch Subscriptions
            </h3>
            <span className="text-[13px] text-text-muted font-mono">7 Categories Available</span>
          </div>

          <div className="divide-y divide-white/5">
            {preferenceItems.map((item) => {
              const isChecked = prefs[item.key];
              return (
                <div
                  key={item.key}
                  className="py-4 flex items-start justify-between gap-4 transition-colors hover:bg-white/[0.02] px-2 rounded-xl"
                >
                  <div className="flex items-start space-x-3.5 min-w-0">
                    <div className="p-2.5 rounded-xl bg-navy-950 border border-[#D4AC54]/60 shrink-0 mt-0.5">
                      {item.icon}
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-semibold text-[#2F241A]">{item.title}</h4>
                      <p className="text-xs text-text-muted leading-relaxed">{item.description}</p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isChecked}
                    onClick={() => handleToggle(item.key)}
                    className={`w-12 h-6 rounded-full transition-colors relative shrink-0 focus:outline-none focus:ring-2 focus:ring-gold-500/50 ${
                      isChecked ? 'bg-gold-500' : 'bg-navy-950 border border-white/20'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-navy-950 shadow-md absolute top-1 transition-transform ${
                        isChecked ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Action Bar */}
          <div className="pt-4 border-t border-[#D4AC54]/60 flex items-center justify-between">
            {isSaved ? (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Preferences saved successfully!
              </span>
            ) : (
              <span className="text-xs text-text-muted font-mono">Changes apply to all registered email addresses.</span>
            )}

            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              isLoading={saving}
              className="bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-xs"
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Email Preferences
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
