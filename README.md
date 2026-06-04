# Duplicate Analyzer

A Strapi 5 plugin that finds and manages duplicate entries across all your content types. Scan individual collections or generate a site-wide master report, then delete duplicates with full restore capability.

## Features

- **Per-content-type scan** — pick a content type, a field, and find exact-match duplicate groups
- **Master Report** — scan every collection type and every searchable field in one click, with a paginated flat table
- **Locale-aware** — for localized content types, duplicates are detected per locale (not mixed across locales)
- **Batch delete** — checkbox-select entries within a group and delete them all at once
- **Keep newest** — delete all older entries in a duplicate group while preserving the newest
- **Safe delete** — deleted entries are stored in a plugin-owned content type with full entry data; nothing is permanently lost
- **Restore** — one-click restore recreates the entry with all original data: components, media (images/files), relations, publication status, and locale
- **Auto-cleanup** — deleted-entry records older than 1 day are automatically removed
- **Export** — download the Master Report as CSV, Excel (SpreadsheetML .xls), or PDF (print view)

## Clone the repository

```bash
git clone https://github.com/sahrawataditya/strapi-duplicate-analyzer.git
```

Install the all dependencies:
```bash
npm install
# or
yarn install
#or
pnpm install
```

Then build or restart your Strapi project:

```bash
npm run build
# or
npm run develop
```

## Usage

The plugin adds a "Duplicate Analyzer" section in your Strapi admin sidebar.

### Duplicates Tab

1. Select a **Content Type** from the dropdown
2. Select a **Field** to scan (only searchable fields are shown: string, text, email, uid, integer, biginteger, float, decimal)
3. If the content type is localized, optionally pick a **Locale** (defaults to all locales)
4. Click **Find Duplicates**

Each result row shows a duplicate value, the number of entries sharing it, and actions. Click **View N** to expand the group and see individual entries with checkboxes, preview links, and delete buttons.

### Master Report Tab

Click **Scan All Content Types** to generate a site-wide report. The summary bar shows how many content types, fields, and locales were scanned, plus the total duplicate groups and entries found.

The table groups results by content type and field. Use the **CSV**, **Excel**, or **PDF** buttons to export the full report.

### Deleted Entries Tab

Lists all entries that were deleted through the plugin. Each entry can be **Restored** — this recreates the original entry with all components, media, relations, publication status, and locale preserved.

Old deleted-entry records are automatically cleaned up after 24 hours.

## Locale Support

- The **Duplicates** tab shows a locale selector when the selected content type supports i18n
- The **Master Report** automatically detects all configured locales and scans each one independently, so duplicates in English and French are reported separately
- The Locale column in the Master Report shows which locale each duplicate group belongs to
- Restored entries are recreated in their original locale

## Development

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Watch for changes (auto-rebuild)
npm run watch

# Link to a local Strapi project for testing
npm run watch:link
```

## Technical Notes

- Uses Strapi 5 Document Service API (`strapi.documents()`)
- Media fields are restored using numeric `id` (required by Document Service `create()`)
- Relations are restored using `documentId` (string)
- Components are deeply cleaned of system fields before restore; dynamic zones preserve `__component`
- The admin panel runs on a different port in dev mode — `window.strapi.backendURL` bridges the two

## License

MIT
