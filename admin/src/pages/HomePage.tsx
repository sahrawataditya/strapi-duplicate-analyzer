import { useState, useEffect, useCallback, Fragment } from "react";
import {
  Main,
  Table,
  Thead,
  Tbody,
  Tr,
  Td,
  Th,
  Typography,
  Button,
  SingleSelect,
  SingleSelectOption,
  Flex,
  Box,
  Dialog,
  Field,
} from "@strapi/design-system";
import {
  Layouts,
  useFetchClient,
  useNotification,
} from "@strapi/strapi/admin";
import { Trash, ArrowClockwise, CaretDown, CaretUp, Cross } from "@strapi/icons";
import { PLUGIN_ID } from "../pluginId";

type ContentType = {
  uid: string;
  singularName: string;
  pluralName: string;
  displayName: string;
  hasI18n: boolean;
};

type ContentField = {
  name: string;
  type: string;
  required: boolean;
};

type Locale = {
  code: string;
  name: string;
};

type Entry = {
  documentId: string;
  [key: string]: unknown;
};

type DuplicateGroup = {
  value: string;
  count: number;
  entries: Entry[];
};

type MasterGroup = {
  uid: string;
  displayName: string;
  field: string;
  value: string;
  count: number;
  entries: Entry[];
  locale?: string;
};

type ScanSummary = {
  contentTypesScanned: number;
  fieldsScanned: number;
  totalEntriesScanned: number;
  duplicateGroupsFound: number;
  totalDuplicateEntries: number;
  localesScanned?: number;
};

type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

const HomePage = () => {
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [fields, setFields] = useState<ContentField[]>([]);
  const [locales, setLocales] = useState<Locale[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedValues, setExpandedValues] = useState<string[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

  const [masterGroups, setMasterGroups] = useState<MasterGroup[]>([]);
  const [masterPagination, setMasterPagination] = useState<PaginationMeta | null>(null);
  const [masterPage, setMasterPage] = useState(1);
  const [masterSummary, setMasterSummary] = useState<ScanSummary | null>(null);
  const [scanning, setScanning] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [activeTab, setActiveTab] = useState<"duplicates" | "deleted" | "master">("duplicates");
  const [deletedEntries, setDeletedEntries] = useState<Entry[]>([]);
  const [deletedPagination, setDeletedPagination] = useState<PaginationMeta | null>(null);
  const [deletedPage, setDeletedPage] = useState(1);

  const [confirmDelete, setConfirmDelete] = useState<{ uid: string | null; documentId: string; locale?: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoadError(null);
        console.log(`[${PLUGIN_ID}] Fetching content types...`);
        const { data } = await get(`/${PLUGIN_ID}/content-types`);
        if (Array.isArray(data)) {
          console.log(`[${PLUGIN_ID}] Loaded ${data.length} content types`);
          setContentTypes(data);
        } else {
          console.error(`[${PLUGIN_ID}] Unexpected content-types response:`, data);
          setLoadError("Failed to load content types: unexpected response format");
          setContentTypes([]);
        }
      } catch (err) {
        console.error(`[${PLUGIN_ID}] Failed to load content types:`, err);
        setLoadError(`Failed to load content types: ${err instanceof Error ? err.message : "Unknown error"}`);
        setContentTypes([]);
      }
    })();
  }, []);

  const handleUidChange = useCallback(async (uid: string | number) => {
    const val = String(uid);
    setSelectedUid(val);
    setSelectedField(null);
    setSelectedLocale(null);
    setFields([]);
    setLocales([]);
    setGroups([]);
    setPagination(null);
    setExpandedValues([]);
    setSelectedEntries(new Set());

    if (!val) return;
    console.log(`[${PLUGIN_ID}] Selected CT: "${val}"`);

    const ct = contentTypes.find((c) => c.uid === val);

    try {
      const { data: f } = await get(`/${PLUGIN_ID}/content-types/${encodeURIComponent(val)}/fields`);
      console.log(`[${PLUGIN_ID}] Loaded ${(f || []).length} fields for CT="${val}"`);
      setFields(f || []);
    } catch (err) {
      console.warn(`[${PLUGIN_ID}] Failed to load fields for CT="${val}":`, err);
      setFields([]);
    }

    if (ct?.hasI18n) {
      try {
        const { data: locs } = await get(`/${PLUGIN_ID}/locales`);
        console.log(`[${PLUGIN_ID}] Loaded ${(locs || []).length} locales`);
        setLocales(locs || []);
      } catch (err) {
        console.warn(`[${PLUGIN_ID}] Failed to load locales:`, err);
        setLocales([]);
      }
    }
  }, [contentTypes]);

  const selectedCt = contentTypes.find((c) => c.uid === selectedUid);

  const handleFind = async (page = 1) => {
    if (!selectedUid || !selectedField) return;
    console.log(`[${PLUGIN_ID}] Finding duplicates: CT="${selectedUid}" field="${selectedField}" locale="${selectedLocale || "all"}" page=${page}`);
    setLoading(true);
    setExpandedValues([]);
    setSelectedEntries(new Set());
    try {
      const { data } = await post(`/${PLUGIN_ID}/duplicates/find`, {
        uid: selectedUid,
        field: selectedField,
        locale: selectedLocale,
        page,
        pageSize: 10,
      });
      const groupCount = data?.groups?.length || 0;
      const total = data?.pagination?.total || 0;
      console.log(`[${PLUGIN_ID}] Found ${total} duplicate groups, showing ${groupCount} on page ${page}`);
      setGroups(data?.groups || []);
      setPagination(data?.pagination || null);
      setCurrentPage(page);
      if (groupCount === 0) {
        toggleNotification({ type: "info", message: "No duplicates found" });
      }
    } catch (err) {
      console.error(`[${PLUGIN_ID}] Find duplicates request failed:`, err);
      toggleNotification({ type: "warning", message: "Failed to find duplicates" });
      setGroups([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    console.log(`[${PLUGIN_ID}] Deleting entry: CT="${confirmDelete.uid}" documentId="${confirmDelete.documentId}" locale="${confirmDelete.locale || "default"}"`);
    setDeleting(true);
    try {
      await post(`/${PLUGIN_ID}/duplicates/delete`, {
        uid: confirmDelete.uid,
        documentId: confirmDelete.documentId,
        locale: confirmDelete.locale,
      });
      console.log(`[${PLUGIN_ID}] Entry deleted successfully: documentId="${confirmDelete.documentId}"`);
      toggleNotification({ type: "success", message: "Entry deleted" });
      setConfirmDelete(null);
      setDeleting(false);
      handleFind(currentPage);
    } catch (err) {
      console.error(`[${PLUGIN_ID}] Failed to delete entry documentId="${confirmDelete.documentId}":`, err);
      toggleNotification({ type: "warning", message: "Failed to delete entry" });
      setConfirmDelete(null);
      setDeleting(false);
    }
  };

  const toggleSelectEntry = (documentId: string) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(documentId)) {
        next.delete(documentId);
      } else {
        next.add(documentId);
      }
      return next;
    });
  };

  const handleDeleteSelected = async (uid: string, entries: { documentId: string; locale?: string }[], afterCallback?: () => void) => {
    if (!uid || entries.length === 0) return;
    console.log(`[${PLUGIN_ID}] Batch deleting ${entries.length} entries from CT="${uid}"`);
    setDeleting(true);
    let deleted = 0;
    let failed = 0;
    for (const { documentId, locale } of entries) {
      try {
        await post(`/${PLUGIN_ID}/duplicates/delete`, { uid, documentId, locale });
        deleted++;
      } catch (err) {
        failed++;
        console.warn(`[${PLUGIN_ID}] Batch delete failed for documentId="${documentId}":`, err);
      }
    }
    console.log(`[${PLUGIN_ID}] Batch delete completed: ${deleted} deleted, ${failed} failed`);
    toggleNotification({ type: "success", message: `${deleted} entr${deleted === 1 ? "y" : "ies"} deleted` });
    setSelectedEntries(new Set());
    setDeleting(false);
    if (afterCallback) {
      afterCallback();
    } else {
      handleFind(currentPage);
    }
  };

  const loadDeleted = async (page = 1) => {
    console.log(`[${PLUGIN_ID}] Loading deleted entries: page=${page}`);
    try {
      const { data } = await get(`/${PLUGIN_ID}/duplicates/deleted?page=${page}&pageSize=10`);
      if (data?.results && Array.isArray(data.results)) {
        console.log(`[${PLUGIN_ID}] Loaded ${data.results.length} deleted entries (total: ${data.pagination?.total || "?"})`);
        setDeletedEntries(data.results);
        setDeletedPagination(data.pagination || null);
        setDeletedPage(page);
      } else {
        console.warn(`[${PLUGIN_ID}] Unexpected deleted entries response:`, data);
        setDeletedEntries([]);
        setDeletedPagination(null);
      }
    } catch (err) {
      console.error(`[${PLUGIN_ID}] Failed to load deleted entries:`, err);
      toggleNotification({ type: "warning", message: "Failed to load deleted entries" });
      setDeletedEntries([]);
      setDeletedPagination(null);
    }
  };

  const handleRestore = async (documentId: string) => {
    console.log(`[${PLUGIN_ID}] Restoring entry: deletedEntryId="${documentId}"`);
    setDeleting(true);
    try {
      await post(`/${PLUGIN_ID}/duplicates/restore`, { deletedEntryId: documentId });
      console.log(`[${PLUGIN_ID}] Entry restored successfully: deletedEntryId="${documentId}"`);
      toggleNotification({ type: "success", message: "Entry restored" });
      loadDeleted(deletedPage);
    } catch (err) {
      console.error(`[${PLUGIN_ID}] Failed to restore entry deletedEntryId="${documentId}":`, err);
      toggleNotification({ type: "warning", message: "Failed to restore entry" });
    } finally {
      setDeleting(false);
    }
  };

  const handleScanAll = async (page = 1) => {
    console.log(`[${PLUGIN_ID}] Master scan: page=${page}`);
    setScanning(true);
    setExpandedValues([]);
    setSelectedEntries(new Set());
    try {
      const { data } = await post(`/${PLUGIN_ID}/duplicates/scan`, { page, pageSize: 10 });
      setMasterGroups(data?.groups || []);
      setMasterPagination(data?.pagination || null);
      setMasterSummary(data?.summary || null);
      setMasterPage(page);
      if (!data?.groups?.length) {
        toggleNotification({ type: "info", message: "No duplicates found across any content type" });
      }
    } catch (err) {
      console.error(`[${PLUGIN_ID}] Master scan failed:`, err);
      toggleNotification({ type: "warning", message: "Failed to scan all content types" });
      setMasterGroups([]);
      setMasterPagination(null);
      setMasterSummary(null);
    } finally {
      setScanning(false);
    }
  };

  const handleMasterDelete = async () => {
    if (!confirmDelete) return;
    const { uid, documentId, locale } = confirmDelete;
    console.log(`[${PLUGIN_ID}] Master delete entry: CT="${uid}" documentId="${documentId}"`);
    setDeleting(true);
    try {
      await post(`/${PLUGIN_ID}/duplicates/delete`, { uid, documentId, locale });
      toggleNotification({ type: "success", message: "Entry deleted" });
      setConfirmDelete(null);
      setDeleting(false);
      handleScanAll(masterPage);
    } catch (err) {
      console.error(`[${PLUGIN_ID}] Master delete failed documentId="${documentId}":`, err);
      toggleNotification({ type: "warning", message: "Failed to delete entry" });
      setConfirmDelete(null);
      setDeleting(false);
    }
  };

  const fetchAllMasterData = async () => {
    const { data } = await post(`/${PLUGIN_ID}/duplicates/scan`, { page: 1, pageSize: 9999 });
    return data?.groups || [];
  };

  const escapeXml = (s: string) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const exportCSV = async () => {
    setExporting(true);
    const allGroups = await fetchAllMasterData();
    const header = "Content Type,Field,Duplicate Value,Locale,Count";
    const rows = allGroups.map((g: MasterGroup) =>
      `"${g.displayName}","${g.field}","${(g.value || "").replace(/"/g, '""')}","${g.locale || "default"}","${g.count}"`
    ).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + header + "\n" + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "duplicate-report.csv"; a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const exportExcel = async () => {
    setExporting(true);
    const allGroups = await fetchAllMasterData();
    const esc = escapeXml;
    const rows = allGroups.map((g: MasterGroup) =>
      `    <Row><Cell><Data ss:Type="String">${esc(g.displayName)}</Data></Cell><Cell><Data ss:Type="String">${esc(g.field)}</Data></Cell><Cell><Data ss:Type="String">${esc(g.value)}</Data></Cell><Cell><Data ss:Type="String">${esc(g.locale || "default")}</Data></Cell><Cell><Data ss:Type="Number">${g.count}</Data></Cell></Row>`
    ).join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Duplicates">
  <Table>
   <Row>
    <Cell><Data ss:Type="String">Content Type</Data></Cell>
    <Cell><Data ss:Type="String">Field</Data></Cell>
    <Cell><Data ss:Type="String">Duplicate Value</Data></Cell>
    <Cell><Data ss:Type="String">Locale</Data></Cell>
    <Cell><Data ss:Type="String">Count</Data></Cell>
   </Row>
${rows}
  </Table>
 </Worksheet>
</Workbook>`;
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "duplicate-report.xls"; a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const exportPDF = async () => {
    setExporting(true);
    const allGroups = await fetchAllMasterData();
    const esc = escapeXml;
    const rows = allGroups.map((g: MasterGroup) =>
      `<tr><td>${esc(g.displayName)}</td><td>${esc(g.field)}</td><td>${esc(g.value)}</td><td>${esc(g.locale || "default")}</td><td>${g.count}</td></tr>`
    ).join("");
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Duplicate Report</title>
<style>
body{font-family:sans-serif;margin:20px}
h1{font-size:18px;margin-bottom:12px}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #999;padding:6px 8px;font-size:11px;text-align:left}
th{background:#2563eb;color:#fff}
</style></head><body>
<h1>Duplicate Report</h1>
<table><thead><tr><th>Content Type</th><th>Field</th><th>Duplicate Value</th><th>Locale</th><th>Count</th></tr></thead>
<tbody>${rows}</tbody></table>
<script>window.print()</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
    setExporting(false);
  };

  const handleTabChange = (tab: "duplicates" | "deleted" | "master") => {
    console.log(`[${PLUGIN_ID}] Switched to tab: "${tab}"`);
    setActiveTab(tab);
    if (tab === "deleted") {
      loadDeleted(1);
    } else if (tab === "master" && masterGroups.length === 0 && !scanning) {
      handleScanAll(1);
    }
  };

  const renderPagination = (
    pag: PaginationMeta,
    currPage: number,
    onPageChange: (p: number) => void,
    busy: boolean = false
  ) => {
    const pages: (number | "...")[] = [];
    if (pag.pageCount <= 7) {
      for (let i = 1; i <= pag.pageCount; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currPage > 3) pages.push("...");
      for (let i = Math.max(2, currPage - 1); i <= Math.min(pag.pageCount - 1, currPage + 1); i++) {
        pages.push(i);
      }
      if (currPage < pag.pageCount - 2) pages.push("...");
      pages.push(pag.pageCount);
    }

    return (
      <Flex justifyContent="center" padding={4} gap={1}>
        <Button
          variant="tertiary"
          size="S"
          disabled={currPage <= 1 || busy}
          onClick={() => onPageChange(currPage - 1)}
        >
          {busy ? "..." : "Previous"}
        </Button>
        {pages.map((p) =>
          p === "..." ? (
            <Box key="ellipsis" padding={1}>
              <Typography variant="pi" textColor="neutral600">…</Typography>
            </Box>
          ) : (
            <Button
              key={p}
              variant={p === currPage ? "default" : "tertiary"}
              size="S"
              disabled={busy}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          )
        )}
        <Button
          variant="tertiary"
          size="S"
          disabled={currPage >= pag.pageCount || busy}
          onClick={() => onPageChange(currPage + 1)}
        >
          {busy ? "..." : "Next"}
        </Button>
      </Flex>
    );
  };

  return (
    <Main>
      <Layouts.Header
        title="Duplicate Analyzer"
        subtitle="Find and manage duplicate entries across content types"
      />

      <Layouts.Content>
        {loadError && (
          <Box paddingBottom={4}>
            <Typography textColor="danger600">{loadError}</Typography>
          </Box>
        )}

        <Box paddingBottom={6}>
          <Flex gap={4} alignItems="end" wrap="wrap">
            <Box minWidth="200px">
              <Field.Root>
                <Field.Label>Content Type</Field.Label>
                <SingleSelect
                  placeholder="Select a content type..."
                  value={selectedUid}
                  onChange={(v: string | number) => handleUidChange(v)}
                >
                  {contentTypes.map((ct) => (
                    <SingleSelectOption key={ct.uid} value={ct.uid}>
                      {ct.displayName}
                    </SingleSelectOption>
                  ))}
                </SingleSelect>
              </Field.Root>
            </Box>

            <Box minWidth="180px">
              <Field.Root>
                <Field.Label>Field</Field.Label>
                <SingleSelect
                  placeholder="Select field..."
                  onChange={(v: string | number) => setSelectedField(String(v))}
                  value={selectedField}
                  disabled={!selectedUid}
                >
                  {fields.map((f) => (
                    <SingleSelectOption key={f.name} value={f.name}>
                      {f.name} ({f.type})
                    </SingleSelectOption>
                  ))}
                </SingleSelect>
              </Field.Root>
            </Box>

            {selectedCt?.hasI18n && (
              <Box minWidth="160px">
                <Field.Root>
                  <Field.Label>Locale</Field.Label>
                  <SingleSelect
                    placeholder="All locales"
                    onChange={(v: string | number) => setSelectedLocale(String(v))}
                    value={selectedLocale}
                  >
                    {locales.map((loc) => (
                      <SingleSelectOption key={loc.code} value={loc.code}>
                        {loc.name} ({loc.code})
                      </SingleSelectOption>
                    ))}
                  </SingleSelect>
                </Field.Root>
              </Box>
            )}

            <Box>
              <Button
                onClick={() => handleFind(1)}
                disabled={!selectedUid || !selectedField || loading || deleting}
              >
                {loading ? "Scanning..." : "Find Duplicates"}
              </Button>
            </Box>
          </Flex>
        </Box>

        <Flex gap={2} paddingBottom={4}>
          <Button
            variant={activeTab === "duplicates" ? "default" : "tertiary"}
            onClick={() => handleTabChange("duplicates")}
          >
            Duplicates
          </Button>
          <Button
            variant={activeTab === "master" ? "default" : "tertiary"}
            onClick={() => handleTabChange("master")}
          >
            Master Report
          </Button>
          <Button
            variant={activeTab === "deleted" ? "default" : "tertiary"}
            onClick={() => handleTabChange("deleted")}
          >
            Deleted Entries
          </Button>
        </Flex>

        {activeTab === "duplicates" && (
          <Box>
            {groups.length > 0 ? (
              <>
                <div style={{ overflowX: "auto", maxWidth: "100%" }}>
                <Table rowCount={groups.length} colCount={5}>
                  <Thead>
                    <Tr>
                      <Th>#</Th>
                      <Th>Duplicate Value</Th>
                      <Th>Count</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {groups.map((group, idx) => {
                      const isExpanded = expandedValues.includes(group.value);
                      const selectedCount = group.entries.filter((e: any) =>
                        selectedEntries.has(e.documentId)
                      ).length;
                      return (
                        <Fragment key={group.value + idx}>
                          <Tr>
                            <Td>
                              <Typography>{(currentPage - 1) * pagination!.pageSize + idx + 1}</Typography>
                            </Td>
                            <Td style={{ maxWidth: 300, overflow: "hidden" }}>
                              <Box minWidth={0} maxWidth="300px" overflow="hidden">
                                <Typography textColor="primary600" ellipsis>
                                  {group.value}
                                </Typography>
                              </Box>
                            </Td>
                            <Td>
                              <Typography>{group.count}</Typography>
                            </Td>
                            <Td>
                              <Flex gap={2}>
                                <Button
                                  size="S"
                                  variant="tertiary"
                                  startIcon={isExpanded ? <CaretUp /> : <CaretDown />}
                                  onClick={() =>
                                    setExpandedValues((prev) =>
                                      prev.includes(group.value)
                                        ? prev.filter((v) => v !== group.value)
                                        : [...prev, group.value]
                                    )
                                  }
                                >
                                  {isExpanded ? "Hide" : `View ${group.count}`}
                                </Button>
                                {selectedCount > 0 && (
                                  <Button
                                    size="S"
                                    variant="danger"
                                    startIcon={<Trash />}
                                    disabled={deleting}
                                      onClick={() => {
                                        const selected = group.entries
                                          .filter((e: any) => selectedEntries.has(e.documentId))
                                          .map((e: any) => ({ documentId: e.documentId, locale: e.locale }));
                                        handleDeleteSelected(selectedUid!, selected);
                                      }}
                                  >
                                    {deleting ? "..." : `Delete (${selectedCount})`}
                                  </Button>
                                )}
                              </Flex>
                            </Td>
                          </Tr>
                          {isExpanded &&
                            group.entries.map((entry: any) => {
                              const isSelected = selectedEntries.has(entry.documentId);
                              return (
                                <Tr key={entry.documentId}>
                                  <Td>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSelectEntry(entry.documentId)}
                                      style={{ cursor: "pointer" }}
                                    />
                                  </Td>
                                  <Td style={{ maxWidth: 200, overflow: "hidden" }}>
                                    <Box minWidth={0} overflow="hidden">
                                      <Typography textColor="neutral600" variant="pi" ellipsis>
                                        {entry.documentId}
                                      </Typography>
                                    </Box>
                                  </Td>
                                  <Td style={{ maxWidth: 300, overflow: "hidden" }}>
                                    {Object.keys(entry)
                                      .filter(
                                        (k) =>
                                          !["id", "documentId", "createdAt", "updatedAt", "publishedAt", "locale", "status"].includes(k)
                                      )
                                      .slice(0, 2)
                                      .map((k) => (
                                        <Typography key={k} variant="pi" textColor="neutral600" ellipsis>
                                          {k}:{" "}
                                          {typeof entry[k] === "object"
                                            ? JSON.stringify(entry[k])
                                            : String(entry[k] ?? "")}
                                        </Typography>
                                      ))}
                                  </Td>
                                  <Td>
                                    <Flex gap={2}>
                                      <a
                                        href={`/admin/content-manager/collection-types/${selectedUid}/${entry.documentId}${entry.locale ? `?plugins[i18n][locale]=${entry.locale}` : ""}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ textDecoration: "none" }}
                                      >
                                        <Button size="S" variant="tertiary">
                                          Preview
                                        </Button>
                                      </a>
                                      <Button
                                        variant="danger-light"
                                        size="S"
                                        startIcon={<Trash />}
                                        disabled={deleting}
                                        onClick={() =>
                                          setConfirmDelete({
                                            uid: selectedUid,
                                            documentId: entry.documentId,
                                            locale: entry.locale,
                                          })
                                        }
                                      >
                                        {deleting ? "..." : "Delete"}
                                      </Button>
                                    </Flex>
                                  </Td>
                                </Tr>
                              );
                            })}
                        </Fragment>
                      );
                    })}
                  </Tbody>
                </Table>
                </div>

                {pagination && renderPagination(pagination, currentPage, (p) => handleFind(p), loading)}
              </>
            ) : (
              <Box padding={8} background="neutral100" hasRadius>
                <Typography textColor="neutral600" textAlign="center">
                  {selectedUid
                    ? "No duplicates found for this content type and field."
                    : "Select a content type and field, then click Find Duplicates."}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {activeTab === "master" && (
          <Box>
            {masterSummary && (
              <Flex justifyContent="space-between" alignItems="center" paddingBottom={4}>
                <Typography variant="epsilon" textColor="neutral600">
                  Scanned {masterSummary.contentTypesScanned} content types / {masterSummary.fieldsScanned} fields
                  {masterSummary.localesScanned && masterSummary.localesScanned > 1
                    ? ` / ${masterSummary.localesScanned} locales`
                    : ""} —
                  {" "}{masterSummary.duplicateGroupsFound} duplicate groups ({masterSummary.totalDuplicateEntries} entries)
                </Typography>
                <Flex gap={2}>
                  <Button variant="tertiary" size="S" disabled={exporting || scanning || masterGroups.length === 0} onClick={exportCSV}>
                    {exporting ? "..." : "CSV"}
                  </Button>
                  <Button variant="tertiary" size="S" disabled={exporting || scanning || masterGroups.length === 0} onClick={exportExcel}>
                    {exporting ? "..." : "Excel"}
                  </Button>
                  <Button variant="tertiary" size="S" disabled={exporting || scanning || masterGroups.length === 0} onClick={exportPDF}>
                    {exporting ? "..." : "PDF"}
                  </Button>
                </Flex>
              </Flex>
            )}

            {!scanning && masterGroups.length === 0 && !masterSummary && (
              <Box padding={4}>
                <Button onClick={() => handleScanAll(1)} startIcon={<ArrowClockwise />}>
                  Scan All Content Types
                </Button>
              </Box>
            )}

            {scanning && (
              <Box padding={8} background="neutral100" hasRadius>
                <Typography textColor="neutral600" textAlign="center">
                  Scanning all content types...
                </Typography>
              </Box>
            )}

            {masterGroups.length > 0 && (
              <>
                <div style={{ overflowX: "auto", maxWidth: "100%" }}>
                <Table rowCount={masterGroups.length} colCount={7}>
                  <Thead>
                    <Tr>
                      <Th>#</Th>
                      <Th>Content Type</Th>
                      <Th>Field</Th>
                      <Th>Duplicate Value</Th>
                      <Th>Locale</Th>
                      <Th>Count</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {masterGroups.map((group, idx) => {
                      const groupKey = `${group.uid}|${group.field}|${group.value}`;
                      const isExpanded = expandedValues.includes(groupKey);
                      const selectedCount = group.entries.filter((e: any) =>
                        selectedEntries.has(e.documentId)
                      ).length;
                      return (
                        <Fragment key={groupKey}>
                          <Tr>
                            <Td>
                              <Typography>{(masterPage - 1) * 10 + idx + 1}</Typography>
                            </Td>
                            <Td>
                              <Typography>{group.displayName}</Typography>
                            </Td>
                            <Td>
                              <Typography textColor="neutral600">{group.field}</Typography>
                            </Td>
                            <Td style={{ maxWidth: 300, overflow: "hidden" }}>
                              <Box minWidth={0} maxWidth="300px" overflow="hidden">
                                <Typography textColor="primary600" ellipsis>
                                  {group.value}
                                </Typography>
                              </Box>
                            </Td>
                            <Td>
                              <Typography textColor="neutral600">{group.locale || "default"}</Typography>
                            </Td>
                            <Td>
                              <Typography>{group.count}</Typography>
                            </Td>
                            <Td>
                              <Flex gap={2}>
                                <Button
                                  size="S"
                                  variant="tertiary"
                                  startIcon={isExpanded ? <CaretUp /> : <CaretDown />}
                                  onClick={() =>
                                    setExpandedValues((prev) =>
                                      prev.includes(groupKey)
                                        ? prev.filter((v) => v !== groupKey)
                                        : [...prev, groupKey]
                                    )
                                  }
                                >
                                  {isExpanded ? "Hide" : `View ${group.count}`}
                                </Button>
                                {selectedCount > 0 && (
                                  <Button
                                    size="S"
                                    variant="danger"
                                    startIcon={<Trash />}
                                    disabled={deleting}
                                    onClick={() => {
                                      const selected = group.entries
                                        .filter((e: any) => selectedEntries.has(e.documentId))
                                        .map((e: any) => ({ documentId: e.documentId, locale: e.locale }));
                                      handleDeleteSelected(group.uid, selected, () => handleScanAll(masterPage));
                                    }}
                                  >
                                    {deleting ? "..." : `Delete (${selectedCount})`}
                                  </Button>
                                )}
                              </Flex>
                            </Td>
                          </Tr>
                          {isExpanded &&
                            group.entries.map((entry: any) => {
                              const isSelected = selectedEntries.has(entry.documentId);
                              return (
                                <Tr key={entry.documentId}>
                                  <Td>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSelectEntry(entry.documentId)}
                                      style={{ cursor: "pointer" }}
                                    />
                                  </Td>
                                  <Td style={{ maxWidth: 200, overflow: "hidden" }}>
                                    <Typography textColor="neutral600" variant="pi" ellipsis>
                                      {entry.documentId}
                                    </Typography>
                                  </Td>
                                  <Td colSpan={3} style={{ maxWidth: 300, overflow: "hidden" }}>
                                    {Object.keys(entry)
                                      .filter(
                                        (k) =>
                                          !["id", "documentId", "createdAt", "updatedAt", "publishedAt", "locale", "status"].includes(k)
                                      )
                                      .slice(0, 2)
                                      .map((k) => (
                                        <Typography key={k} variant="pi" textColor="neutral600" ellipsis>
                                          {k}:{" "}
                                          {typeof entry[k] === "object"
                                            ? JSON.stringify(entry[k])
                                            : String(entry[k] ?? "")}
                                        </Typography>
                                      ))}
                                    {entry.locale && (
                                      <Typography variant="pi" textColor="primary600" ellipsis>
                                        locale: {entry.locale}
                                      </Typography>
                                    )}
                                  </Td>
                                  <Td colSpan={2}>
                                    <Flex gap={2}>
                                      <a
                                        href={`/admin/content-manager/collection-types/${group.uid}/${entry.documentId}${entry.locale ? `?plugins[i18n][locale]=${entry.locale}` : ""}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ textDecoration: "none" }}
                                      >
                                        <Button size="S" variant="tertiary">
                                          Preview
                                        </Button>
                                      </a>
                                      <Button
                                        variant="danger-light"
                                        size="S"
                                        startIcon={<Trash />}
                                        disabled={deleting}
                                        onClick={() =>
                                          setConfirmDelete({
                                            uid: group.uid,
                                            documentId: entry.documentId,
                                            locale: entry.locale,
                                          })
                                        }
                                      >
                                        {deleting ? "..." : "Delete"}
                                      </Button>
                                    </Flex>
                                  </Td>
                                </Tr>
                              );
                            })}
                        </Fragment>
                      );
                    })}
                  </Tbody>
                </Table>
                </div>

                {masterPagination && renderPagination(masterPagination, masterPage, (p) => handleScanAll(p), scanning)}
              </>
            )}

            {!scanning && masterGroups.length === 0 && masterSummary && (
              <Box padding={8} background="neutral100" hasRadius>
                <Typography textColor="neutral600" textAlign="center">
                  No duplicates found across any content type.
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {activeTab === "deleted" && (
          <Box>
            {deletedEntries.length > 0 ? (
              <>
                <div style={{ overflowX: "auto", maxWidth: "100%" }}>
                <Table rowCount={deletedEntries.length} colCount={5}>
                  <Thead>
                    <Tr>
                      <Th>#</Th>
                      <Th>Content Type</Th>
                      <Th>Entry ID</Th>
                      <Th>Deleted At</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {deletedEntries.map((entry, idx) => (
                      <Tr key={entry.documentId}>
                        <Td>
                          <Typography>{(deletedPage - 1) * 10 + idx + 1}</Typography>
                        </Td>
                        <Td>
                          <Typography>{entry.contentType as string}</Typography>
                        </Td>
                        <Td>
                          <Typography textColor="primary600">{entry.entryId as string}</Typography>
                        </Td>
                        <Td>
                          <Typography>{entry.deletedAt as string}</Typography>
                        </Td>
                        <Td>
                          <Button
                            variant="success-light"
                            size="S"
                            startIcon={<ArrowClockwise />}
                            disabled={deleting}
                            onClick={() => handleRestore(entry.documentId)}
                          >
                            {deleting ? "..." : "Restore"}
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
                </div>

                {deletedPagination &&
                  renderPagination(deletedPagination, deletedPage, (p) => loadDeleted(p), deleting)}
              </>
            ) : (
              <Box padding={8} background="neutral100" hasRadius>
                <Typography textColor="neutral600" textAlign="center">
                  No deleted entries found.
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Layouts.Content>

      {confirmDelete && (
        <Dialog.Root
          open={!!confirmDelete}
          onOpenChange={() => setConfirmDelete(null)}
        >
          <Dialog.Content>
            <Dialog.Header>Confirm Deletion</Dialog.Header>
            <Dialog.Body>
              <Typography>
                Are you sure you want to delete this entry? It will be stored for potential
                restoration.
              </Typography>
            </Dialog.Body>
            <Dialog.Footer>
              <Flex gap={2} justifyContent="flex-end">
                <Button onClick={() => setConfirmDelete(null)} variant="tertiary" disabled={deleting}>
                  Cancel
                </Button>
                <Button onClick={activeTab === "master" ? handleMasterDelete : handleDelete} variant="danger" startIcon={<Trash />} disabled={deleting} loading={deleting}>
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
              </Flex>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </Main>
  );
};

export { HomePage };
