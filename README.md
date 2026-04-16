# routetools-webapp

[日本語のREADMEはこちら](README.ja.md)

A browser-based SPA for editing route files (GPX / KML / KMZ / TCX) and adding POIs for cycling GPS devices such as Garmin, Wahoo, Bryton, Pioneer, etc.

This is the web counterpart of the CLI tool [routetools-cli](https://github.com/ysait0/routetools-cli). No installation or account required — everything runs in your browser, and your files never leave your device.

## Features

- Load route files (GPX / KML / KMZ / TCX) and preview them on an interactive map
- Add POIs from another route file or a CSV
- Add POIs manually by clicking on the route
- Inline edit POI name, description, and type (Generic / Flag / Straight / Left / Right)
- Adjust tolerance distance and toggle "Force" (snap to nearest route point)
- Download the result as TCX or GPX
- Japanese / English UI

## Usage

Just open the hosted page in your browser:

**<https://ysait0.github.io/routetools-webapp/>**

1. Drop (or click to select) a route file onto the "Route File" zone
2. (Optional) Drop another route file or a CSV onto the "Add POI" zone, or click on the route on the map to add POIs manually
3. Edit POI name / description / type inline in the list
4. Pick output format (TCX / GPX) and adjust tolerance / force
5. Click "Download"

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

## Tech stack

- Vanilla JavaScript (no framework, no build step)
- [Leaflet](https://leafletjs.com/) for the map
- [JSZip](https://stuk.github.io/jszip/) for KMZ extraction
- OpenStreetMap tiles

## Related

- [routetools-cli](https://github.com/ysait0/routetools-cli) — CLI version with the same feature set

## License

MIT License. See [LICENSE](LICENSE).
