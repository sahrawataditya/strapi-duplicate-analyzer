import type { Core } from "@strapi/strapi";

const PLUGIN_ID = "duplicate-analyzer";

const log = (level: "log" | "warn" | "error", msg: string, meta?: any) => {
  const prefix = `[${PLUGIN_ID}]`;
  if (meta !== undefined) {
    console[level](`${prefix} ${msg}`, meta);
  } else {
    console[level](`${prefix} ${msg}`);
  }
};

const buildPopulate = (contentType: any): Record<string, any> => {
  const populate: Record<string, any> = {};
  for (const [key, attr] of Object.entries(contentType.attributes) as [string, any][]) {
    if (["component", "dynamiczone", "media", "relation"].includes(attr.type)) {
      populate[key] = true;
    }
  }
  return populate;
};

const service = ({ strapi }: { strapi: Core.Strapi }) => ({
  async findDuplicates(
    uid: string,
    field: string,
    page: number = 1,
    pageSize: number = 10,
    locale?: string
  ) {
    const types = strapi.contentTypes as Record<string, any>;
    const contentType = types[uid];
    if (!contentType) {
      log("warn", `findDuplicates: content type not found: "${uid}"`);
      throw new Error(`Content type "${uid}" not found`);
    }

    const params: Record<string, any> = { limit: 9999 };
    if (locale) {
      params.locale = locale;
    }

    const docs = (strapi.documents as any)(uid);
    const allEntries = await docs.findMany(params);
    log("log", `findDuplicates: fetched ${allEntries.length} entries for CT="${uid}" field="${field}" locale="${locale || "default"}"`);

    // Group entries by the selected field's value
    const groups = new Map<string, any[]>();
    for (const entry of allEntries) {
      const val = entry[field];
      if (val === null || val === undefined) continue;
      const key = typeof val === "object" ? JSON.stringify(val) : String(val);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(entry);
    }

    // Keep only groups with more than 1 entry (actual duplicates)
    const duplicateGroups = Array.from(groups.entries())
      .filter(([, entries]) => entries.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    const total = duplicateGroups.length;
    const pageCount = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const pageGroups = duplicateGroups.slice(start, start + pageSize);
    log("log", `findDuplicates: ${total} duplicate groups found, returning page ${page}/${pageCount}`);

    return {
      groups: pageGroups.map(([value, entries]) => ({
        value,
        count: entries.length,
        entries,
      })),
      pagination: {
        page,
        pageSize,
        total,
        pageCount,
      },
    };
  },

  async scanAll(page: number = 1, pageSize: number = 10) {
    const types = strapi.contentTypes as Record<string, any>;
    const excluded = ["admin::", "plugin::", "strapi::", "::"];

    const collectionTypes = Object.values(types)
      .filter((ct: any) => !excluded.some((p) => (ct.uid as string).startsWith(p)))
      .filter((ct: any) => ct.kind === "collectionType");

    const searchableTypes = [
      "string", "text", "email", "uid", "integer",
      "biginteger", "float", "decimal",
    ];

    // Fetch all i18n locales so we can scan each locale separately for localized CTs
    let allLocales: string[] = [];
    try {
      const localesService = strapi.plugin("i18n")?.service("locales");
      if (localesService) {
        const localeResults = await localesService.find();
        allLocales = (localeResults || []).map((l: any) => l.code);
        log("log", `scanAll: loaded ${allLocales.length} locales for per-locale scanning`);
      }
    } catch (err: any) {
      log("warn", `scanAll: could not fetch locales (${err.message}), scanning default locale only`);
    }

    const allGroups: Array<{
      uid: string;
      displayName: string;
      field: string;
      value: string;
      count: number;
      entries: any[];
      locale?: string;
    }> = [];

    let totalEntriesScanned = 0;
    let uniqueFieldsScanned = 0;

    for (const ct of collectionTypes) {
      const uid: string = ct.uid;
      const isLocalized = !!ct.pluginOptions?.i18n?.localized;
      // For localized CTs, scan each locale independently;
      // for non-localized, scan once with no locale filter
      const localeList = isLocalized && allLocales.length > 0 ? allLocales : [null as string | null];

      const fields = Object.entries(ct.attributes || {})
        .filter(([, attr]: [string, any]) => searchableTypes.includes(attr.type))
        .map(([name]) => name);

      if (fields.length > 0) uniqueFieldsScanned += fields.length;

      for (const locale of localeList) {
        for (const field of fields) {
          try {
            const docs = (strapi.documents as any)(uid);
            const params: Record<string, any> = { limit: 9999 };
            if (locale) params.locale = locale;
            const allEntries = await docs.findMany(params);
            totalEntriesScanned += allEntries.length;

            const groups = new Map<string, any[]>();
            for (const entry of allEntries) {
              const val = entry[field];
              if (val === null || val === undefined) continue;
              const key = typeof val === "object" ? JSON.stringify(val) : String(val);
              if (!groups.has(key)) {
                groups.set(key, []);
              }
              groups.get(key)!.push(entry);
            }

            for (const [value, entries] of groups.entries()) {
              if (entries.length > 1) {
                const group: any = {
                  uid,
                  displayName: ct.info?.displayName || ct.info?.singularName || uid,
                  field,
                  value,
                  count: entries.length,
                  entries,
                };
                if (locale) group.locale = locale;
                allGroups.push(group);
              }
            }
          } catch (err: any) {
            log("warn", `scanAll: error CT="${uid}" field="${field}" locale="${locale || "default"}": ${err.message}`);
          }
        }
      }
    }

    allGroups.sort((a, b) => b.count - a.count || a.uid.localeCompare(b.uid));

    const total = allGroups.length;
    const pageCount = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const pageGroups = allGroups.slice(start, start + pageSize);

    log("log", `scanAll: ${collectionTypes.length} CTs / ${uniqueFieldsScanned} fields / ${allLocales.length > 0 ? `${allLocales.length} locales` : "no i18n"} / ${totalEntriesScanned} entries — ${total} duplicate groups`);
    return {
      summary: {
        contentTypesScanned: collectionTypes.length,
        fieldsScanned: uniqueFieldsScanned,
        totalEntriesScanned,
        duplicateGroupsFound: total,
        totalDuplicateEntries: allGroups.reduce((sum, g) => sum + g.count, 0),
        localesScanned: allLocales.length > 0 ? allLocales.length : 1,
      },
      groups: pageGroups,
      pagination: {
        page,
        pageSize,
        total,
        pageCount,
      },
    };
  },

  async deleteEntry(uid: string, documentId: string, locale?: string) {
    const types = strapi.contentTypes as Record<string, any>;
    const contentType = types[uid];
    if (!contentType) {
      log("warn", `deleteEntry: content type not found: "${uid}"`);
      throw new Error(`Content type "${uid}" not found`);
    }

    const docs = (strapi.documents as any)(uid);
    const findParams: Record<string, any> = { documentId, populate: buildPopulate(contentType) };
    if (locale) findParams.locale = locale;
    const entry = await docs.findOne(findParams);
    if (!entry) {
      log("warn", `deleteEntry: entry not found documentId="${documentId}" CT="${uid}"`);
      throw new Error(`Entry "${documentId}" not found in "${uid}"`);
    }

    const deleteParams: Record<string, any> = { documentId };
    if (locale) deleteParams.locale = locale;
    await docs.delete(deleteParams);
    log("log", `deleteEntry: deleted documentId="${documentId}" CT="${uid}" locale="${locale || "default"}"`);

    await (strapi.documents as any)(
      `plugin::${PLUGIN_ID}.deleted-entry`
    ).create({
      data: {
        contentType: uid,
        entryId: documentId,
        entryData: entry,
        deletedAt: new Date().toISOString(),
      },
    });
    log("log", `deleteEntry: saved restore log for documentId="${documentId}"`);

    return { success: true, documentId };
  },

  async deleteOlderInGroup(
    uid: string,
    field: string,
    value: string,
    locale?: string
  ) {
    const types = strapi.contentTypes as Record<string, any>;
    const contentType = types[uid];
    if (!contentType) {
      log("warn", `deleteOlderInGroup: content type not found: "${uid}"`);
      throw new Error(`Content type "${uid}" not found`);
    }

    const params: Record<string, any> = {
      filters: { [field]: { $eq: value } },
      sort: { createdAt: "asc" },
      limit: 9999,
      populate: buildPopulate(contentType),
    };
    if (locale) {
      params.locale = locale;
    }

    const docs = (strapi.documents as any)(uid);
    const allEntries = await docs.findMany(params);
    if (allEntries.length < 2) {
      log("log", `deleteOlderInGroup: fewer than 2 entries for CT="${uid}" field="${field}" value="${value}", nothing to delete`);
      return { deletedCount: 0, keptEntry: allEntries[0] || null };
    }

    // Keep the newest (last in ascending sort), delete all older
    const kept = allEntries[allEntries.length - 1];
    const toDelete = allEntries.slice(0, -1);
    log("log", `deleteOlderInGroup: deleting ${toDelete.length} older entries, keeping newest documentId="${kept.documentId}" CT="${uid}" field="${field}"`);

    for (const entry of toDelete) {
      await docs.delete({ documentId: entry.documentId });
      await (strapi.documents as any)(`plugin::${PLUGIN_ID}.deleted-entry`).create({
        data: {
          contentType: uid,
          entryId: entry.documentId,
          entryData: entry,
          deletedAt: new Date().toISOString(),
        },
      });
    }

    log("log", `deleteOlderInGroup: completed, ${toDelete.length} entries deleted and logged`);
    return { deletedCount: toDelete.length, keptEntry: kept };
  },

  async restoreEntry(deletedEntryId: string) {
    const deletedEntry = await (strapi.documents as any)(
      `plugin::${PLUGIN_ID}.deleted-entry`
    ).findOne({ documentId: deletedEntryId });

    if (!deletedEntry) {
      log("warn", `restoreEntry: deleted-entry record not found deletedEntryId="${deletedEntryId}"`);
      throw new Error(`Deleted entry record "${deletedEntryId}" not found`);
    }

    const { contentType, entryData } = deletedEntry;

    if (!entryData) {
      log("error", `restoreEntry: entryData is missing in deleted-entry record deletedEntryId="${deletedEntryId}"`);
      throw new Error("No entry data found for restoration");
    }

    const types = strapi.contentTypes as Record<string, any>;
    const ct = types[contentType];
    log("log", `restoreEntry: restoring entry from deletedEntryId="${deletedEntryId}" to CT="${contentType}" ct=${!!ct}`);
    if (ct) {
      log("log", `restoreEntry: CT attributes: [${Object.keys(ct.attributes || {}).join(", ")}]`);
    }

    const data = { ...entryData } as Record<string, any>;

    // Strip system and user fields that should not be passed to create()
    delete data.id;
    delete data.documentId;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.createdBy;
    delete data.updatedBy;
    delete data.publishedBy;
    delete data.localizations;
    // Keep publishedAt so restored entry retains its original publication status

    // Extract locale from data to pass separately to create()
    const entryLocale = data.locale;
    delete data.locale;

    // Recursively sanitize data using content-type / component attribute schemas:
    //   - media → collapse populated objects to numeric `id` (Document Service create() expects numeric IDs for media)
    //   - relation → collapse populated objects to `documentId` (string)
    //   - component/dynamiczone → strip system fields, then recurse into child attributes
    const collapseMedia = (value: any): any => {
      if (value == null) return value;
      if (Array.isArray(value)) {
        return value.map((item: any) =>
          item && typeof item === "object" && item.id != null
            ? item.id
            : item
        );
      }
      if (typeof value === "object" && value.id != null) return value.id;
      return value;
    };

    const collapseRelation = (value: any): any => {
      if (value == null) return value;
      if (Array.isArray(value)) {
        return value.map((item: any) =>
          item && typeof item === "object" && item.documentId != null
            ? item.documentId
            : item
        );
      }
      if (typeof value === "object" && value.documentId != null) return value.documentId;
      return value;
    };

    const sanitizeBySchema = (value: any, attrs: Record<string, any>, keepComponent = false): any => {
      if (value == null) return value;
      if (Array.isArray(value)) {
        return value.map((item) => sanitizeBySchema(item, attrs, keepComponent));
      }
      if (typeof value === "object") {
        const result: Record<string, any> = {};
        for (const [key, val] of Object.entries(value)) {
          if (
            ["id", "documentId", "createdAt", "updatedAt", "publishedAt"].includes(key)
          ) {
            continue;
          }
          if (key === "__component" && !keepComponent) {
            continue;
          }
          const attrDef = attrs[key];
          if (attrDef?.type === "media") {
            result[key] = collapseMedia(val);
          } else if (attrDef?.type === "relation") {
            result[key] = collapseRelation(val);
          } else if (attrDef?.type === "component") {
            const compAttrs =
              (strapi.components as any)?.[attrDef.component]?.attributes || {};
            if (Array.isArray(val)) {
              result[key] = val.map((item) => sanitizeBySchema(item, compAttrs, false));
            } else if (val && typeof val === "object") {
              result[key] = sanitizeBySchema(val, compAttrs, false);
            } else {
              result[key] = val;
            }
          } else if (attrDef?.type === "dynamiczone") {
            if (Array.isArray(val)) {
              result[key] = val.map((item: any) => {
                const compName = item.__component;
                if (compName) {
                  const dzAttrs =
                    (strapi.components as any)?.[compName]?.attributes || {};
                  return sanitizeBySchema(item, dzAttrs, true);
                }
                return item;
              });
            } else {
              result[key] = val;
            }
          } else {
            result[key] = val;
          }
        }
        return result;
      }
      return value;
    };

    if (ct) {
      const topLevelAttrs = ct.attributes || {};
      for (const [key, attr] of Object.entries(topLevelAttrs) as [string, any][]) {
        if (data[key] == null) continue;
        if (attr.type === "component" || attr.type === "dynamiczone") {
          const componentName = attr.type === "component" ? attr.component : null;
          if (attr.type === "component" && componentName) {
            const compAttrs =
              (strapi.components as any)?.[componentName]?.attributes || {};
            if (Array.isArray(data[key])) {
              data[key] = data[key].map((item: any) =>
                sanitizeBySchema(item, compAttrs, false)
              );
            } else if (typeof data[key] === "object") {
              data[key] = sanitizeBySchema(data[key], compAttrs, false);
            }
          } else if (attr.type === "dynamiczone") {
            if (Array.isArray(data[key])) {
              data[key] = data[key].map((item: any) => {
                const compName = item.__component;
                if (compName) {
                  const dzAttrs =
                    (strapi.components as any)?.[compName]?.attributes || {};
                  return sanitizeBySchema(item, dzAttrs, true);
                }
                return item;
              });
            }
          }
        } else if (attr.type === "media") {
          data[key] = collapseMedia(data[key]);
        } else if (attr.type === "relation") {
          data[key] = collapseRelation(data[key]);
        }
      }
    }

    // Deep-strip any remaining system fields that schema-based sanitization might have missed
    const stripSystemDeep = (val: any): any => {
      if (val == null || typeof val !== "object") return val;
      if (Array.isArray(val)) return val.map(stripSystemDeep);
      const cleaned: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        if (["id", "documentId", "createdAt", "updatedAt", "createdBy", "updatedBy", "publishedBy", "publishedAt", "localizations", "locale", "__v"].includes(k)) continue;
        cleaned[k] = stripSystemDeep(v);
      }
      return cleaned;
    };

    const deepCleaned = stripSystemDeep(data);
    log("log", `restoreEntry: data for create() keys=[${Object.keys(deepCleaned).join(", ")}]`);

    // Pass locale explicitly so Document Service creates in the right locale
    const createParams: Record<string, any> = { data: deepCleaned };
    if (entryLocale) {
      createParams.locale = entryLocale;
    }
    log("log", `restoreEntry: createParams.locale="${createParams.locale || "default"}" CT="${contentType}"`);
    try {
      await (strapi.documents as any)(contentType).create(createParams);
    } catch (err: any) {
      log("error", `restoreEntry: create() failed error="${err.message}"`);
      for (const [k, v] of Object.entries(deepCleaned)) {
        const full = JSON.stringify(v);
        log("error", `restoreEntry: field "${k}" type="${typeof v}" ${Array.isArray(v) ? `array[${v.length}]` : ""} ${full.length > 5000 ? `len=${full.length}` : `val=${full}`}`);
      }
      throw err;
    }
    log("log", `restoreEntry: created new entry in CT="${contentType}" locale="${entryLocale || "default"}"`);

    await (strapi.documents as any)(
      `plugin::${PLUGIN_ID}.deleted-entry`
    ).delete({ documentId: deletedEntryId });
    log("log", `restoreEntry: removed restore log deletedEntryId="${deletedEntryId}"`);

    return { success: true, documentId: deletedEntryId };
  },

  async cleanupOldDeletedEntries() {
    const docs = (strapi.documents as any)(
      `plugin::${PLUGIN_ID}.deleted-entry`
    );
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const oldEntries = await docs.findMany({
      filters: { deletedAt: { $lt: oneDayAgo.toISOString() } },
      limit: 9999,
    });

    for (const entry of oldEntries) {
      await docs.delete({ documentId: entry.documentId });
    }

    if (oldEntries.length > 0) {
      log("log", `cleanup: removed ${oldEntries.length} expired deleted-entry records older than ${oneDayAgo.toISOString()}`);
    }

    return { deletedCount: oldEntries.length };
  },

  async getDeletedEntries(page: number = 1, pageSize: number = 10) {
    await this.cleanupOldDeletedEntries();

    const docs = (strapi.documents as any)(
      `plugin::${PLUGIN_ID}.deleted-entry`
    );
    const start = (page - 1) * pageSize;
    const results = await docs.findMany({
      limit: pageSize,
      start,
      sort: { deletedAt: "desc" },
    });
    const all = await docs.findMany({
      limit: 9999,
      sort: { deletedAt: "desc" },
    });
    const total = all.length;
    log("log", `getDeletedEntries: page=${page} pageSize=${pageSize} returned=${results.length} total=${total}`);

    return {
      results,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  },
});

export default service;
