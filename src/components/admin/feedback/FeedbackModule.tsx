import React, { useState, useEffect } from 'react';
import type { FeedbackCampaign, FeedbackCampaignVersion } from '@/types/feedback';
import { getCampaigns } from '@/services/feedbackService';
import { Tabs } from '@/components/ui/Tabs';
import { CampaignsList } from './CampaignsList';
import { CampaignEditor } from './CampaignEditor';
import { CampaignDetail } from './CampaignDetail';
import { ResponsesList } from './ResponsesList';
import { ArchiveList } from './ArchiveList';
import { FeedbackSettingsView } from './FeedbackSettingsView';
import { FeedbackPreviewModal } from './FeedbackPreviewModal';

type SubTab = 'campaigns' | 'responses' | 'archive' | 'settings';

interface FeedbackModuleProps {
  onNavigateToSearch?: () => void;
}

export const FeedbackModule: React.FC<FeedbackModuleProps> = () => {
  const [activeTab, setActiveTab] = useState<SubTab>('campaigns');
  const [campaigns, setCampaigns] = useState<FeedbackCampaign[]>([]);

  // Deep-view state for Campaigns sub-tab
  const [campaignView, setCampaignView] = useState<'list' | 'create' | 'edit' | 'detail'>('list');
  const [selectedCampaign, setSelectedCampaign] = useState<FeedbackCampaign | null>(null);

  // Test mode state
  const [testModalState, setTestModalState] = useState<{
    open: boolean;
    campaign: FeedbackCampaign | null;
    version: FeedbackCampaignVersion | null;
  }>({
    open: false,
    campaign: null,
    version: null,
  });

  const loadData = async () => {
    try {
      const data = await getCampaigns();
      setCampaigns(data);
      // Keep selectedCampaign synchronized
      if (selectedCampaign) {
        const updated = data.find((c) => c.id === selectedCampaign.id);
        if (updated) setSelectedCampaign(updated);
      }
    } catch {
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as SubTab);
    setCampaignView('list');
    setSelectedCampaign(null);
  };

  const handleCreate = () => {
    setSelectedCampaign(null);
    setCampaignView('create');
  };

  const handleEdit = (campaign: FeedbackCampaign) => {
    setSelectedCampaign(campaign);
    setCampaignView('edit');
  };

  const handleSelect = (campaign: FeedbackCampaign) => {
    setSelectedCampaign(campaign);
    setCampaignView('detail');
  };

  const handleSaved = (campaign: FeedbackCampaign) => {
    loadData();
    setSelectedCampaign(campaign);
    setCampaignView('detail');
  };

  const handleTestOnMyself = (
    campaign: FeedbackCampaign,
    version?: FeedbackCampaignVersion
  ) => {
    const activeVersion =
      version ||
      campaign.versions?.find((v) => v.id === campaign.current_version_id) ||
      campaign.versions?.[0] ||
      null;

    setTestModalState({
      open: true,
      campaign,
      version: activeVersion,
    });
  };

  const activeCount = campaigns.filter((c) => c.status === 'active').length;
  const archivedCount = campaigns.filter((c) => c.status === 'archived').length;

  const TABS = [
    { id: 'campaigns', label: 'Campaigns', count: activeCount > 0 ? activeCount : undefined },
    { id: 'responses', label: 'Responses' },
    { id: 'archive', label: 'Archive', count: archivedCount > 0 ? archivedCount : undefined },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs */}
      {campaignView === 'list' && (
        <div className="border-b border-border pb-3">
          <Tabs
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            aria-label="Feedback module navigation"
          />
        </div>
      )}

      {/* Campaigns View Container */}
      {activeTab === 'campaigns' && (
        <>
          {campaignView === 'list' && (
            <CampaignsList
              campaigns={campaigns}
              onCreate={handleCreate}
              onSelect={handleSelect}
              onEdit={handleEdit}
              onRefresh={loadData}
              onTestOnMyself={handleTestOnMyself}
            />
          )}

          {(campaignView === 'create' || campaignView === 'edit') && (
            <CampaignEditor
              campaign={campaignView === 'edit' ? selectedCampaign : null}
              onBack={() => setCampaignView('list')}
              onSaved={handleSaved}
              onTestOnMyself={(camp, ver) => handleTestOnMyself(camp, ver)}
            />
          )}

          {campaignView === 'detail' && selectedCampaign && (
            <CampaignDetail
              campaign={selectedCampaign}
              onBack={() => setCampaignView('list')}
              onEdit={handleEdit}
              onRefresh={loadData}
              onTestOnMyself={handleTestOnMyself}
            />
          )}
        </>
      )}

      {/* Responses Sub-tab */}
      {activeTab === 'responses' && <ResponsesList />}

      {/* Archive Sub-tab */}
      {activeTab === 'archive' && (
        <ArchiveList
          campaigns={campaigns}
          onSelect={(c) => {
            setSelectedCampaign(c);
            setActiveTab('campaigns');
            setCampaignView('detail');
          }}
          onRefresh={loadData}
        />
      )}

      {/* Settings Sub-tab */}
      {activeTab === 'settings' && <FeedbackSettingsView />}

      {/* Test On Myself Preview Modal */}
      {testModalState.open && (
        <FeedbackPreviewModal
          open={testModalState.open}
          onClose={() =>
            setTestModalState({ open: false, campaign: null, version: null })
          }
          question={testModalState.version?.question || 'Was this result useful?'}
          config={
            testModalState.version?.configuration || {
              positive_label: 'Yes',
              negative_label: 'No',
              negative_reasons: [],
              comment_enabled: true,
            }
          }
        />
      )}
    </div>
  );
};
