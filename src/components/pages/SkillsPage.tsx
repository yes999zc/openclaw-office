import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, RefreshCw, Package, Search, ShieldCheck, X } from "lucide-react";
import type { SkillInfo } from "@/gateway/adapter-types";
import { useSkillsStore } from "@/store/console-stores/skills-store";
import { LoadingState } from "@/components/console/shared/LoadingState";
import { ErrorState } from "@/components/console/shared/ErrorState";
import { EmptyState } from "@/components/console/shared/EmptyState";
import { SkillTabBar } from "@/components/console/skills/SkillTabBar";
import { SkillCard } from "@/components/console/skills/SkillCard";
import { MarketplaceSkillCard } from "@/components/console/skills/MarketplaceSkillCard";
import { SkillDetailDialog } from "@/components/console/skills/SkillDetailDialog";
import { InstallOptionsDialog } from "@/components/console/skills/InstallOptionsDialog";
import {
  filterInstalledSkills,
  filterMarketplaceSkills,
  getInstalledSkillIds,
} from "@/store/console-stores/skills-store";

export function SkillsPage() {
  const { t } = useTranslation("console");
  const {
    skills, isLoading, error,
    activeTab, sourceFilter,
    selectedSkill, detailDialogOpen, installing,
    fetchSkills, setTab, setSourceFilter,
    openDetail, closeDetail, toggleSkill, installSkill,
  } = useSkillsStore();

  const [installTarget, setInstallTarget] = useState<SkillInfo | null>(null);
  const [installedQuery, setInstalledQuery] = useState("");
  const [marketplaceQuery, setMarketplaceQuery] = useState("");

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const installedSkills = useMemo(
    () => filterInstalledSkills(skills, installedQuery, sourceFilter),
    [skills, installedQuery, sourceFilter],
  );
  const marketplaceSkills = useMemo(
    () => filterMarketplaceSkills(skills, marketplaceQuery),
    [skills, marketplaceQuery],
  );
  const installedSkillIds = useMemo(() => getInstalledSkillIds(skills), [skills]);

  const sourceStats = useMemo(
    () => ({
      all: skills.filter((skill) => skill.isBundled || skill.eligible).length,
      "built-in": skills.filter((skill) => skill.isBundled).length,
      marketplace: skills.filter((skill) => !skill.isBundled).length,
    }),
    [skills],
  );

  const handleInstall = (skill: SkillInfo) => {
    if (skill.installOptions && skill.installOptions.length > 1) {
      setInstallTarget(skill);
    } else if (skill.installOptions && skill.installOptions.length === 1) {
      installSkill(skill.id, skill.installOptions[0].id);
    }
  };

  const handleInstallSelect = async (installId: string) => {
    if (installTarget) {
      await installSkill(installTarget.id, installId);
      setInstallTarget(null);
    }
  };

  if (isLoading && skills.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("skills.title")} description={t("skills.description")} onRefresh={fetchSkills} />
        <LoadingState />
      </div>
    );
  }

  if (error && skills.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("skills.title")} description={t("skills.description")} onRefresh={fetchSkills} />
        <ErrorState message={error} onRetry={fetchSkills} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("skills.title")} description={t("skills.description")} onRefresh={fetchSkills} loading={isLoading} />

      <SkillTabBar
        activeTab={activeTab}
        onTabChange={setTab}
      />

      {activeTab === "installed" ? (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={installedQuery}
                onChange={(event) => setInstalledQuery(event.target.value)}
                placeholder={t("skills.installed.searchPlaceholder")}
                className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-700 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(["all", "built-in", "marketplace"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSourceFilter(filter)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${sourceFilter === filter ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"}`}
                >
                  {t(`skills.filters.${filter}`, { count: sourceStats[filter] })}
                </button>
              ))}
            </div>
          </div>

          {installedSkills.length === 0 ? (
            <EmptyState icon={Package} title={t("skills.empty.title")} description={t("skills.empty.description")} />
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {installedSkills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onToggle={toggleSkill}
                  onConfigure={openDetail}
                  isInstalling={installing.has(skill.id)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/60">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-gray-500" />
              <p className="text-sm text-gray-600 dark:text-gray-300">{t("skills.marketplace.securityNote")}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={marketplaceQuery}
                onChange={(event) => setMarketplaceQuery(event.target.value)}
                placeholder={t("skills.marketplace.searchPlaceholder")}
                className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-10 pr-10 text-sm text-gray-700 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
              {marketplaceQuery && (
                <button
                  type="button"
                  onClick={() => setMarketplaceQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {t("skills.marketplace.searchButton")}
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/10 dark:text-red-400">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            </div>
          )}

          {marketplaceSkills.length === 0 ? (
            <EmptyState
              icon={Package}
              title={t("skills.marketplace.emptyTitle")}
              description={marketplaceQuery ? t("skills.marketplace.noResults") : t("skills.marketplace.emptyDescription")}
            />
          ) : (
            <div className="space-y-4">
              {marketplaceSkills.map((skill) => (
                <MarketplaceSkillCard
                  key={skill.id}
                  skill={skill}
                  isInstalled={installedSkillIds.has(skill.id) && Boolean(skill.eligible)}
                  isInstalling={installing.has(skill.id)}
                  onInstall={handleInstall}
                  onOpenDetail={openDetail}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <SkillDetailDialog
        open={detailDialogOpen}
        skill={selectedSkill}
        onClose={closeDetail}
        onSaved={fetchSkills}
      />

      <InstallOptionsDialog
        open={installTarget !== null}
        skillName={installTarget?.name ?? ""}
        options={installTarget?.installOptions ?? []}
        onSelect={handleInstallSelect}
        onCancel={() => setInstallTarget(null)}
      />
    </div>
  );
}

function PageHeader({ title, description, onRefresh, loading }: { title: string; description: string; onRefresh: () => void; loading?: boolean }) {
  const { t } = useTranslation("common");
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        {t("actions.refresh")}
      </button>
    </div>
  );
}
