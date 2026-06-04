import type { Core } from "@strapi/strapi";

const PLUGIN_ID = "duplicate-analyzer";
const EXCLUDED_PREFIXES = ["admin::", "plugin::", "strapi::", "::"];

const service = ({ strapi }: { strapi: Core.Strapi }) => ({
  getContentTypes() {
    const types = strapi.contentTypes as Record<string, any>;
    const cts = Object.values(types)
      .filter((ct: any) => {
        const uid: string = ct.uid;
        return !EXCLUDED_PREFIXES.some((p) => uid.startsWith(p));
      })
      .filter((ct: any) => ct.kind === "collectionType")
      .map((ct: any) => ({
        uid: ct.uid,
        singularName: ct.info?.singularName,
        pluralName: ct.info?.pluralName,
        displayName: ct.info?.displayName || ct.info?.singularName || ct.uid,
        hasI18n: !!ct.pluginOptions?.i18n?.localized,
      }));
    console.log(`[${PLUGIN_ID}] getContentTypes: returning ${cts.length} collection types`);
    return cts;
  },

  getContentTypeFields(uid: string) {
    const types = strapi.contentTypes as Record<string, any>;
    const contentType = types[uid];
    if (!contentType) {
      console.warn(`[${PLUGIN_ID}] getContentTypeFields: CT "${uid}" not found`);
      return [];
    }

    const searchableTypes = [
      "string", "text", "email", "uid", "integer",
      "biginteger", "float", "decimal",
    ];

    const fields = Object.entries(contentType.attributes || {})
      .filter(([, attr]: [string, any]) => searchableTypes.includes(attr.type))
      .map(([name, attr]: [string, any]) => ({
        name,
        type: attr.type,
        required: !!attr.required,
      }));
    console.log(`[${PLUGIN_ID}] getContentTypeFields: CT="${uid}" returning ${fields.length} searchable fields`);
    return fields;
  },

  async getLocales() {
    try {
      const locales = strapi.plugin("i18n")?.service("locales");
      if (!locales) {
        console.log(`[${PLUGIN_ID}] getLocales: i18n plugin not available`);
        return [];
      }
      const results = await locales.find();
      console.log(`[${PLUGIN_ID}] getLocales: returning ${(results || []).length} locales`);
      return results || [];
    } catch (err) {
      console.error(`[${PLUGIN_ID}] getLocales: error fetching locales`, err);
      return [];
    }
  },
});

export default service;
