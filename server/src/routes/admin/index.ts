export default () => ({
  type: "admin",
  routes: [
    {
      method: "GET",
      path: "/content-types",
      handler: "content-type.list",
      config: { policies: [] },
    },
    {
      method: "GET",
      path: "/content-types/:uid/fields",
      handler: "content-type.fields",
      config: { policies: [] },
    },
    {
      method: "GET",
      path: "/locales",
      handler: "content-type.locales",
      config: { policies: [] },
    },
    {
      method: "POST",
      path: "/duplicates/find",
      handler: "duplicate.find",
      config: { policies: [] },
    },
    {
      method: "POST",
      path: "/duplicates/delete",
      handler: "duplicate.delete",
      config: { policies: [] },
    },
    {
      method: "POST",
      path: "/duplicates/delete-older",
      handler: "duplicate.deleteOlder",
      config: { policies: [] },
    },
    {
      method: "POST",
      path: "/duplicates/restore",
      handler: "duplicate.restore",
      config: { policies: [] },
    },
    {
      method: "GET",
      path: "/duplicates/deleted",
      handler: "duplicate.deleted",
      config: { policies: [] },
    },
    {
      method: "POST",
      path: "/duplicates/scan",
      handler: "duplicate.scan",
      config: { policies: [] },
    },
  ],
});
