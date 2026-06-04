import type { Core } from "@strapi/strapi";
import deletedEntry from "./deleted-entry/schema.json";

const contentTypes: Record<string, { schema: any }> = {
  "deleted-entry": {
    schema: deletedEntry,
  },
};

export default contentTypes;
