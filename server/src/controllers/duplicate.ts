import type { Core } from "@strapi/strapi";

const PLUGIN_ID = "duplicate-analyzer";

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx) {
    try {
      const { uid, field, page = 1, pageSize = 10, locale } = ctx.request.body as any;
      console.log(`[${PLUGIN_ID}] POST /duplicates/find: CT="${uid}" field="${field}" page=${page} locale="${locale || "default"}"`);
      const results = await strapi
        .plugin("duplicate-analyzer")
        .service("duplicate")
        .findDuplicates(uid, field, Number(page), Number(pageSize), locale);
      ctx.body = results;
    } catch (err: any) {
      console.error(`[${PLUGIN_ID}] POST /duplicates/find error:`, err.message);
      ctx.status = 500;
      ctx.body = { error: err.message };
    }
  },

  async delete(ctx) {
    try {
      const { uid, documentId, locale } = ctx.request.body as any;
      console.log(`[${PLUGIN_ID}] POST /duplicates/delete: CT="${uid}" documentId="${documentId}" locale="${locale || "default"}"`);
      const result = await strapi
        .plugin("duplicate-analyzer")
        .service("duplicate")
        .deleteEntry(uid, documentId, locale);
      ctx.body = result;
    } catch (err: any) {
      console.error(`[${PLUGIN_ID}] POST /duplicates/delete error:`, err.message);
      ctx.status = 500;
      ctx.body = { error: err.message };
    }
  },

  async deleteOlder(ctx) {
    try {
      const { uid, field, value, locale } = ctx.request.body as any;
      console.log(`[${PLUGIN_ID}] POST /duplicates/delete-older: CT="${uid}" field="${field}" value="${value}" locale="${locale || "default"}"`);
      const result = await strapi
        .plugin("duplicate-analyzer")
        .service("duplicate")
        .deleteOlderInGroup(uid, field, value, locale);
      ctx.body = result;
    } catch (err: any) {
      console.error(`[${PLUGIN_ID}] POST /duplicates/delete-older error:`, err.message);
      ctx.status = 500;
      ctx.body = { error: err.message };
    }
  },

  async restore(ctx) {
    try {
      const { deletedEntryId } = ctx.request.body as any;
      console.log(`[${PLUGIN_ID}] POST /duplicates/restore: deletedEntryId="${deletedEntryId}"`);
      const result = await strapi
        .plugin("duplicate-analyzer")
        .service("duplicate")
        .restoreEntry(deletedEntryId);
      ctx.body = result;
    } catch (err: any) {
      console.error(`[${PLUGIN_ID}] POST /duplicates/restore error:`, err.message);
      ctx.status = 500;
      ctx.body = { error: err.message };
    }
  },

  async deleted(ctx) {
    try {
      const { page = 1, pageSize = 10 } = ctx.query as any;
      console.log(`[${PLUGIN_ID}] GET /duplicates/deleted: page=${page} pageSize=${pageSize}`);
      const results = await strapi
        .plugin("duplicate-analyzer")
        .service("duplicate")
        .getDeletedEntries(Number(page), Number(pageSize));
      ctx.body = results;
    } catch (err: any) {
      console.error(`[${PLUGIN_ID}] GET /duplicates/deleted error:`, err.message);
      ctx.status = 500;
      ctx.body = { error: err.message };
    }
  },

  async scan(ctx) {
    try {
      const { page = 1, pageSize = 10 } = ctx.request.body as any;
      console.log(`[${PLUGIN_ID}] POST /duplicates/scan: page=${page} pageSize=${pageSize}`);
      const results = await strapi
        .plugin("duplicate-analyzer")
        .service("duplicate")
        .scanAll(Number(page), Number(pageSize));
      ctx.body = results;
    } catch (err: any) {
      console.error(`[${PLUGIN_ID}] POST /duplicates/scan error:`, err.message);
      ctx.status = 500;
      ctx.body = { error: err.message };
    }
  },
});

export default controller;
