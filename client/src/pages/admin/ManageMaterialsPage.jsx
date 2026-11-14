// FILE: client/src/pages/admin/ManageMaterialsPage.jsx
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import { materialApi } from '../../api/material.api';
import MaterialsModerationTab from '../../components/admin/materials/MaterialsModerationTab';
import MaterialsCatalogTab from '../../components/admin/materials/MaterialsCatalogTab';
import MaterialReportsTab from '../../components/admin/materials/MaterialReportsTab';
import LearningPackagesTab from '../../components/admin/materials/LearningPackagesTab';

const VALID_TABS = ['materials', 'courses', 'reports', 'packages'];

export default function ManageMaterialsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = VALID_TABS.includes(requestedTab) ? requestedTab : 'materials';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [prodiList, setProdiList] = useState([]);
  const [summary, setSummary] = useState({
    pendingMaterials: 0,
    totalMaterials: 0,
    pendingCourses: 0,
    totalCourses: 0,
    pendingReports: 0,
    totalPackages: 0,
  });

  useEffect(() => {
    const paramTab = searchParams.get('tab');
    if (paramTab && VALID_TABS.includes(paramTab) && paramTab !== activeTab) {
      setActiveTab(paramTab);
    }
  }, [searchParams, activeTab]);

  const fetchSummaryAndCatalog = useCallback(async (signal) => {
    const cfg = signal ? { signal } : {};
    const results = await Promise.allSettled([
      materialApi.getProdiList(cfg),
      materialApi.getMaterials({ status: 'pending', limit: 1 }, cfg),
      materialApi.getMaterials({ limit: 1 }, cfg),
      materialApi.getCourses({ status: 'pending', all: true }, cfg),
      materialApi.getCourses({ status: 'approved', limit: 1 }, cfg),
      materialApi.getReports({ status: 'pending', limit: 1 }, cfg),
      materialApi.getLearningPackages({}, cfg),
    ]);

    if (signal?.aborted) return;

    const [pRes, pendMatRes, totMatRes, pendCrsRes, totCrsRes, repRes, pkgRes] = results;

    if (pRes.status === 'fulfilled') {
      setProdiList(pRes.value.data || []);
    }

    setSummary({
      pendingMaterials:
        pendMatRes.status === 'fulfilled'
          ? pendMatRes.value.meta?.total ?? (pendMatRes.value.data?.length || 0)
          : 0,
      totalMaterials:
        totMatRes.status === 'fulfilled'
          ? totMatRes.value.meta?.total ?? (totMatRes.value.data?.length || 0)
          : 0,
      pendingCourses:
        pendCrsRes.status === 'fulfilled' ? pendCrsRes.value.data?.length || 0 : 0,
      totalCourses:
        totCrsRes.status === 'fulfilled'
          ? totCrsRes.value.meta?.total ?? (totCrsRes.value.data?.length || 0)
          : 0,
      pendingReports:
        repRes.status === 'fulfilled'
          ? repRes.value.meta?.total ?? (repRes.value.data?.length || 0)
          : 0,
      totalPackages:
        pkgRes.status === 'fulfilled' ? pkgRes.value.data?.length || 0 : 0,
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchSummaryAndCatalog(controller.signal);
    return () => controller.abort();
  }, [fetchSummaryAndCatalog]);

  const handleTabChange = (_e, val) => {
    setActiveTab(val);
    setSearchParams({ tab: val });
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman Pengelola Materi */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-pasim dark:text-pasim-300">
            Kurikulum & Repositori Akademik
          </span>
          <h1 className="section-title mt-1">Kelola Materi Perkuliahan & Perizinan</h1>
          <p className="text-muted mb-0 mt-1 text-sm">
            Kendalikan izin tayang (ACC), takedown pelanggaran hak cipta, kelola katalog kurikulum mata kuliah, dan paket belajar semester.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/akademik/materi"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-navy-800 dark:text-slate-200"
          >
            <span>Buka Materi Perpustakaan</span>
            <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
          </Link>
        </div>
      </div>

      {/* Quick Stat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card-surface p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
              Menunggu Izin
            </span>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
              {summary.pendingMaterials}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
            <HowToRegRoundedIcon />
          </div>
        </div>

        <div className="card-surface p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
              Total Materi
            </span>
            <div className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">
              {summary.totalMaterials}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <MenuBookRoundedIcon />
          </div>
        </div>

        <div className="card-surface p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
              Usulan MK Baru
            </span>
            <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-0.5">
              {summary.pendingCourses}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
            <SchoolRoundedIcon />
          </div>
        </div>

        <div className="card-surface p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
              Laporan Konten Pending
            </span>
            <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-0.5">
              {summary.pendingReports}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
            <FlagRoundedIcon />
          </div>
        </div>
      </div>

      {/* Navigasi Tab Pengelola Materi */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          <Tab value="materials" label={`Izin & Status Materi (${summary.totalMaterials})`} />
          <Tab
            value="courses"
            label={`Katalog MK (${summary.totalCourses}${
              summary.pendingCourses > 0 ? ` +${summary.pendingCourses}` : ''
            })`}
          />
          <Tab value="reports" label={`Laporan Pelanggaran (${summary.pendingReports})`} />
          <Tab value="packages" label={`Paket Belajar (${summary.totalPackages})`} />
        </Tabs>
      </div>

      {activeTab === 'materials' && (
        <MaterialsModerationTab
          prodiList={prodiList}
          initialStatus={searchParams.get('status') || ''}
          onSummaryChange={() => fetchSummaryAndCatalog()}
        />
      )}

      {activeTab === 'courses' && (
        <MaterialsCatalogTab
          prodiList={prodiList}
          onCatalogChange={() => fetchSummaryAndCatalog()}
        />
      )}

      {activeTab === 'reports' && (
        <MaterialReportsTab onReportHandled={() => fetchSummaryAndCatalog()} />
      )}

      {activeTab === 'packages' && (
        <LearningPackagesTab
          prodiList={prodiList}
          onPackagesChange={() => fetchSummaryAndCatalog()}
        />
      )}
    </div>
  );
}
