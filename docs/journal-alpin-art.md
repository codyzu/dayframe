# Journal alpin weather art

Built-in ImageGen generated one twelve-tile atlas using the earlier, generated
four-state lake concept as a camera reference. The tiles are cropped and
encoded without metadata as individual WebPs in
[public/weather-window](../public/weather-window). This is illustrative artwork
inspired by Lake Annecy. The condition text and forecast come from Open-Meteo.

| Asset family           | Night        | Dawn        | Day        | Dusk        |
| ---------------------- | ------------ | ----------- | ---------- | ----------- |
| Clear and partly clear | clear-night  | clear-dawn  | clear-day  | clear-dusk  |
| Overcast, fog and rain | cloudy-night | cloudy-dawn | cloudy-day | cloudy-dusk |
| Snow                   | snow-night   | snow-dawn   | snow-day   | snow-dusk   |

The prompt for the atlas:

> Use the supplied 2x2 reference contact sheet for camera placement only, each
> panel shows the same view. Redraw this exact locked Lake Annecy shore view as
> ONE precisely divided image atlas, with FOUR columns and THREE rows, exact
> uniform equal cells touching each other with no borders or gaps. Overall
> landscape about 2.7:1. Each individual photograph is about 2.0:1 aspect ratio.
> Seams exactly x=25%,50%,75% y=33.33%,66.67%. No writing, no text, no windows,
> no framing. Every one of the TWELVE tiles shows the matching lake photographed
> at water level, locked camera, same horizon two-thirds down each tile and dark
> peninsula rising on the far right, neutral uncluttered left for large white
> clock later. Photorealistic editorial stills, muted Alpen palette. The atlas
> encodes a very specific matrix: row 1 CLEAR, row 2 CLOUDY and misty with gray
> storm clouds (no visible rain streaks), row 3 SNOW with believable powder on
> the same forested right shore and peaks (no falling flakes). Columns exactly
> in this order: column 1 deep indigo night just before dawn, column 2 sunrise
> pale peach and early cool shore, column 3 full daytime with neutral stronger
> illumination (clear daytime blue; cloudy daytime steel; snow daytime ice
> blue), column 4 dusk with subdued violet and copper and dark lower contrast
> water. For cloudy dawn/dusk show only understated colored light at the
> horizon; the view stays cloudy. For snow at night the snow must remain
> visible under natural cool light. Do not put lanterns, boats, houses, people,
> symbols, artifacts or text in any tile. Same geometry, same scene through
> distinct weather and time, consecutive cells must be visibly different in
> natural light and atmosphere. EXACT 4 columns × 3 rows.
