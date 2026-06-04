import type { Core } from "@strapi/strapi";

const PLUGIN_ID = "duplicate-analyzer";

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  async list(ctx) {
    try {
      const types = strapi
        .plugin("duplicate-analyzer")
        .service("content-type")
        .getContentTypes();
      ctx.body = types;
    } catch (err: any) {
      console.error(`[${PLUGIN_ID}] GET /content-types error:`, err.message);
      ctx.status = 500;
      ctx.body = { error: err.message };
    }
  },

  async fields(ctx) {
    try {
      const { uid } = ctx.params;
      console.log(`[${PLUGIN_ID}] GET /content-types/${uid}/fields`);
      const fields = strapi
        .plugin("duplicate-analyzer")
        .service("content-type")
        .getContentTypeFields(uid);
      ctx.body = fields;
    } catch (err: any) {
      console.error(`[${PLUGIN_ID}] GET /content-types/${ctx.params.uid}/fields error:`, err.message);
      ctx.status = 500;
      ctx.body = { error: err.message };
    }
  },

  async locales(ctx) {
    try {
      const locales = await strapi
        .plugin("duplicate-analyzer")
        .service("content-type")
        .getLocales();
      ctx.body = locales;
    } catch (err: any) {
      console.error(`[${PLUGIN_ID}] GET /locales error:`, err.message);
      ctx.status = 500;
      ctx.body = { error: err.message };
    }
  },
});

export default controller;
