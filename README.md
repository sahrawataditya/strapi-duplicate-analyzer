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

### Via npm

```bash
git clone https://github.com/sahrawataditya/strapi-duplicate-analyzer.git
```

Install all the dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

Then build or restart your Strapi project:

```bash
npm run build
# or
npm run develop
```

### Manual copy into a Strapi project

If you want to use the plugin from source (e.g., for local development, private use, or offline environments):

**Option A — Link (recommended for development)**

```bash
# 1. In the plugin directory, build and watch for changes
cd duplicate-analyzer
npm install
npm run watch:link

# 2. In your Strapi project directory, start the dev server
cd my-strapi-project
npm run develop
```

The plugin auto-rebuilds when you make changes. Both `watch:link` and `develop` must run simultaneously.

**Option B — Manual copy**

```bash
# 1. Build the plugin
cd duplicate-analyzer
npm install
npm run build

# 2. Copy the built plugin into your Strapi project
cp -r dist my-strapi-project/node_modules/duplicate-analyzer/dist

# Or copy the entire folder into src/plugins/ if using local plugin config:
cp -r .. my-strapi-project/src/plugins/duplicate-analyzer
```

Then rebuild your Strapi project:

```bash
cd my-strapi-project
npm run build
```

## Usage

The plugin adds a **Duplicate Analyzer** section in your Strapi admin sidebar with three tabs.

### Duplicates Tab

Scan individual content types for duplicates on a specific field.

1. Select a **Content Type** from the dropdown
2. Select a **Field** to scan (only searchable fields are shown: string, text, email, uid, integer, biginteger, float, decimal)
3. If the content type is localized, optionally pick a **Locale** (defaults to all locales)
4. Click **Find Duplicates**

Each result row shows a duplicate value, the number of entries sharing it, and actions. Click **View N** to expand the group and see individual entries.

#### Batch Delete

Within an expanded group:

1. Check the checkbox next to each entry you want to remove
2. Click **Delete (N)** to delete all selected entries at once

Entries are saved to the Deleted Entries log and can be restored later.

#### Keep Newest

To delete all older entries in a group while preserving the newest one, use the **Delete Older** button on the group row (available in the Duplicates tab).

### Master Report Tab

Click **Scan All Content Types** to generate a site-wide report. The plugin scans every collection type, every searchable field, and (for localized types) every locale.

The summary bar shows:
- Number of content types scanned
- Number of fields scanned
- Number of locales scanned (if i18n is enabled)
- Total duplicate groups and entries found

The table groups results by content type and field with pagination. Expand a row to see individual entries with checkboxes for batch delete.

**Exporting**

Use the buttons above the table to export:

- **CSV** — UTF-8 encoded CSV with BOM (works with Excel, Google Sheets)
- **Excel** — SpreadsheetML format (.xls)
- **PDF** — opens a print view in a new tab (use browser's Save as PDF)

### Deleted Entries Tab

Lists all entries that were deleted through the plugin (auto-cleaned after 24 hours).

Each entry shows:
- Original content type
- Entry document ID
- Deletion timestamp

Click **Restore** to recreate the entry. The restore process preserves:
- All field values
- Components and dynamic zones
- Media relations (images, files)
- Content relations
- Publication status (published / draft)
- Locale

## Locale Support

- The **Duplicates** tab shows a locale selector when the selected content type supports i18n
- The **Master Report** automatically detects all configured locales and scans each one independently, so duplicates in English and French are reported separately
- The Locale column in the Master Report shows which locale each duplicate group belongs to
- Restored entries are recreated in their original locale

## Admin API

The plugin exposes the following admin API endpoints (prefixed with `/duplicate-analyzer`):

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/content-types` | List all collection types with i18n info |
| `GET` | `/content-types/:uid/fields` | List searchable fields for a content type |
| `GET` | `/locales` | List configured i18n locales |
| `POST` | `/duplicates/find` | Find duplicates for a CT + field (body: `{ uid, field, page, pageSize, locale }`) |
| `POST` | `/duplicates/scan` | Master scan across all CTs (body: `{ page, pageSize }`) |
| `POST` | `/duplicates/delete` | Delete a single entry (body: `{ uid, documentId, locale }`) |
| `POST` | `/duplicates/delete-older` | Delete older entries in a group (body: `{ uid, field, value, locale }`) |
| `POST` | `/duplicates/restore` | Restore a deleted entry (body: `{ deletedEntryId }`) |
| `GET` | `/duplicates/deleted` | List deleted entries (query: `?page=&pageSize=`) |

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
