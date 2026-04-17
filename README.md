# routetools-webapp

[日本語のREADMEはこちら](README.ja.md)

A browser-based SPA for converting route files (GPX / KML / KMZ / TCX / FIT) and adding / editing POIs for cycling GPS devices such as Garmin, Wahoo, Bryton, Pioneer, etc.

This is the web counterpart of the CLI tool [routetools-cli](https://github.com/ysait0/routetools-cli). No installation or account required — everything runs in your browser, and your files never leave your device.

## Features

- Load route files (GPX / KML / KMZ / TCX / FIT) and preview them on an interactive map
- Add POIs from another route file or a CSV
- Add POIs manually by clicking on the route
- Edit POI name, description, and type (Generic / Flag / Straight / Left / Right)
- Keep POIs sorted in current route order
- Add Start / Goal POIs together
- Auto-generate and remove turn POIs
- Reverse the route direction with immediate updates to the map, POI list, and elevation profile
- Show an elevation profile with cross-highlighting between the map and profile
- Open Google Maps from a map button to search for nearby facilities (cafes, convenience stores, etc.)
- Undo / Redo via buttons and `Ctrl/Cmd+Z`, `Ctrl+Y`, `Cmd+Shift+Z`
- Adjust tolerance distance and toggle "Force" (snap to nearest route point)
- Download the result as TCX or GPX
- Japanese / English UI

## Supported formats

- Route input: `GPX / KML / KMZ / TCX / FIT`
- POI import: `GPX / KML / KMZ / TCX / FIT / CSV`
- Output: `TCX / GPX`

## Usage

Just open the hosted page in your browser:

**<https://ysait0.github.io/routetools-webapp/>**

1. Drop (or click to select) a route file onto the "Route File" zone
2. Optionally drop another route file or a CSV onto the "Add POI" zone, or click on the route to add POIs manually
3. Edit POI name / description / type in the list or from a marker popup
4. Optionally add Start / Goal POIs, auto-generate turn POIs, or reverse the route direction
5. Use the 🔍 button on the map to open Google Maps and check nearby facilities such as cafes and convenience stores
6. Review the elevation profile, then pick output format (TCX / GPX) and adjust tolerance / force
7. Click "Download"

## CSV format for POI import

```csv
(Latitude),(Longitude),(Name),(Description),(Type)
```

| Field       | Required |
| :---------- | :------: |
| Latitude    |    Y     |
| Longitude   |    Y     |
| Name        |    Y     |
| Description |    Y     |
| Type        |    N     |

Example:

```csv
35.68249921156559,139.77653207620816,PC1,Seven-Eleven Nihonbashi
35.54219882219259,139.76194900229007,Checkpoint1,Tama Sky Bridge,Generic
```

## Run locally

Because this is a pure static site, any static file server works:

```bash
cd routetools-webapp
python3 -m http.server 8000
# open http://localhost:8000
```

## Security

- All files are processed locally in your browser and never sent to any server
- CDN resources (Leaflet / JSZip) are loaded with SRI (Subresource Integrity) hashes
- Content Security Policy (CSP) restricts scripts, images, and connections
- iframe embedding is blocked (`frame-ancestors 'none'`)
- Input file size limit (50 MB) and KMZ decompression size limit (100 MB)

## Tech stack

- Vanilla JavaScript (no framework, no build step)
- [Leaflet](https://leafletjs.com/) for the map
- [JSZip](https://stuk.github.io/jszip/) for KMZ extraction
- [fit-file-parser](https://www.npmjs.com/package/fit-file-parser) for FIT import (loaded dynamically in the browser)
- OpenStreetMap / CyclOSM / GSI (Geospatial Information Authority of Japan) tiles

## Related

- [routetools-cli](https://github.com/ysait0/routetools-cli) — CLI version with the same feature set

## License

MIT License. See [LICENSE](LICENSE).
