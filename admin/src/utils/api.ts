import axios from "axios";
import { PLUGIN_ID } from "../pluginId";

const request = axios.create({
  baseURL: `/${PLUGIN_ID}`,
});

export const api = {
  getContentTypes: async () => {
    const { data } = await request.get("/content-types");
    return data;
  },

  getContentTypeFields: async (uid: string) => {
    const { data } = await request.get(`/content-types/${encodeURIComponent(uid)}/fields`);
    return data;
  },

  findDuplicates: async (
    uid: string,
    field: string,
    value: string,
    page: number = 1,
    pageSize: number = 10
  ) => {
    const { data } = await request.post("/duplicates/find", {
      uid,
      field,
      value,
      page,
      pageSize,
    });
    return data;
  },

  deleteEntry: async (uid: string, documentId: string) => {
    const { data } = await request.post("/duplicates/delete", {
      uid,
      documentId,
    });
    return data;
  },

  restoreEntry: async (deletedEntryId: string) => {
    const { data } = await request.post("/duplicates/restore", {
      deletedEntryId,
    });
    return data;
  },

  getDeletedEntries: async (page: number = 1, pageSize: number = 10) => {
    const { data } = await request.get("/duplicates/deleted", {
      params: { page, pageSize },
    });
    return data;
  },
};
