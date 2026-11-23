# The Natal Engine: files

- `engine.js`: the engine itself (small-body table, core, library, drawing, page logic), written for this site.
- `astronomy.min.js`: Astronomy Engine 2.1.19 by Don Cross, MIT licence (https://github.com/cosinekitty/astronomy). Planet positions, sidereal time and the gravity simulator.
- `cities.json`: 7,281 cities with coordinates and time zones, from the `city-timezones` package (MIT licence). Fetched only when the chart library opens; the place lookup runs in the browser.

Chiron, Ceres, Pallas, Juno and Vesta start from JPL Small-Body Database elements (epoch JD 2461200.5), integrated offline and saved as a state every five years, 1440 to 2110.
Library birth data and the standing of each birth time are as listed by Astrotheme.
