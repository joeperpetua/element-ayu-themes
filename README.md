# Element Ayu Themes

[Ayu](https://github.com/ayu-theme/vscode-ayu) color themes for [Element](https://element.io), the Matrix client.
The scripts in this project make the themes from the VS Code ayu themes and add them to Element.

## Themes

| Theme                 | Type  | Theme URL                                                                                                    |
| --------------------- | ----- | ------------------------------------------------------------------------------------------------------------ |
| Ayu Dark              | dark  | `https://raw.githubusercontent.com/joeperpetua/element-ayu-themes/main/themes/ayu-dark.theme.json`              |
| Ayu Dark Unbordered   | dark  | `https://raw.githubusercontent.com/joeperpetua/element-ayu-themes/main/themes/ayu-dark-unbordered.theme.json`   |
| Ayu Mirage            | dark  | `https://raw.githubusercontent.com/joeperpetua/element-ayu-themes/main/themes/ayu-mirage.theme.json`            |
| Ayu Mirage Unbordered | dark  | `https://raw.githubusercontent.com/joeperpetua/element-ayu-themes/main/themes/ayu-mirage-unbordered.theme.json` |
| Ayu Light             | light | `https://raw.githubusercontent.com/joeperpetua/element-ayu-themes/main/themes/ayu-light.theme.json`             |
| Ayu Light Unbordered  | light | `https://raw.githubusercontent.com/joeperpetua/element-ayu-themes/main/themes/ayu-light-unbordered.theme.json`  |

The themes use the [Iosevka](https://github.com/be5invis/Iosevka) font for text and Fira Code for code.

## Requirements

- Element Desktop or Element Web, version 1.12.27 or later.
- Node.js 18 or later, for the scripts.

## Install

### 1. Install the Iosevka font

Element cannot load fonts from other websites, so you must install Iosevka on each computer.
If Iosevka is not installed, Element uses Inter.

```sh
npm run font:install
```

You can also download Iosevka from the [Iosevka releases](https://github.com/be5invis/Iosevka/releases) and install it yourself.

### 2. Add the themes in Element

1. Open a room in Element.
2. Type `/devtools` in the message field and press Enter.
3. Under **Other**, select **Custom themes**.
4. Copy a theme URL from the [Themes](#themes) table into **Custom theme URL**.
5. Select **Add custom theme**.
6. Do steps 4 and 5 again for each theme that you want.
7. Close the dialog.
8. Go to **Settings > Appearance** and select an Ayu theme.

Element stores the themes in your Matrix account. All your devices that use this account get the themes.

To get a new version of a theme, open **Custom themes** again and select the re-download button next to the theme.
To remove a theme, select the delete button next to it.

If Element shows "A theme with that name is already installed.", delete the old theme first. Then add it again.

## Advanced: add the themes to config.json

Use this method if you want to keep the themes in the Element Desktop configuration file.
It is also the method for administrators who give the themes to all users of an Element Web installation.

1. Add all themes to the `config.json` file of **Element Desktop**:

    ```sh
    npm run apply:all
    ```

2. Restart Element.
3. Go to **Settings > Appearance** and select an Ayu theme.

For **Element Web**, give the path of its `config.json` file. Then reload Element Web in the browser.

```sh
node install-theme.mjs --all themes --config path/to/element-web/config.json
```

Do not use both methods together. After you add a theme with **Custom themes**, Element uses the theme list in your account.
It then ignores the theme list in `config.json`. This stays true if you delete all themes in **Custom themes**.
To use `config.json` again, remove the `custom_themes` key from the `im.vector.web.settings` account data.
You can do this in `/devtools` with **Explore account data**.

## npm scripts

| Script                     | What it does                                                         |
| -------------------------- | -------------------------------------------------------------------- |
| `npm run gen:all`          | Make all six themes again from the latest VS Code ayu themes.        |
| `npm run gen:<variant>`    | Make one theme. For example `gen:dark` or `gen:mirage-unbordered`.   |
| `npm run apply:all`        | Add all themes in the `themes` folder to the Element `config.json`.  |
| `npm run apply -- <files>` | Add the given theme files to the Element `config.json`.              |
| `npm run font:install`     | Download Iosevka and install it for the current user.                |
| `npm run font:uninstall`   | Remove Iosevka from the font folder of the current user.             |

To give options to a script through npm, put them after `--`. For example:

```sh
npm run font:install -- --dry-run
```

Each script shows its usage with `-h` or `--help`.

## gen-theme.mjs

Makes an Element custom theme from a VS Code color theme.

```sh
node gen-theme.mjs <vscode-theme> [output]
```

| Argument       | Description                                                                             |
| -------------- | --------------------------------------------------------------------------------------- |
| `vscode-theme` | Path or http(s) URL of a VS Code color theme JSON file.                                 |
| `output`       | Element theme file to write. Default: `<input name>.theme.json` in the current folder.  |

Examples:

```sh
node gen-theme.mjs https://raw.githubusercontent.com/ayu-theme/vscode-ayu/refs/heads/master/ayu-dark.json themes/ayu-dark.theme.json
node gen-theme.mjs ayu-light.json
```

### Theme name and type

- The theme name is the `name` field of the VS Code theme.
  If that field is missing, the script uses the input file name. `ayu-mirage.json` gives "Ayu Mirage".
- If the `type` field contains `light`, the result is a light theme. All other types give a dark theme.

### Colors

The script reads these VS Code colors. If a key is missing, it uses the next key in the list.

| Element                                  | VS Code key                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| Timeline background                      | `editor.background`                                                           |
| Room list                                | `sideBar.background`                                                          |
| Space bar                                | `editorGroupHeader.tabsBackground`, `activityBar.background`                  |
| Cards and message bubbles                | `editorWidget.background`                                                     |
| Highlighted messages                     | `editor.lineHighlightBackground`                                              |
| Selected and hovered rows                | `list.activeSelectionBackground`, `editor.selectionBackground`                |
| Secondary text and icons                 | `descriptionForeground`, `foreground`                                         |
| Main text                                | `editor.foreground`, `foreground`                                             |
| Accent, links, buttons and mention pills | `focusBorder`, `button.background`, `textLink.foreground`                     |
| Errors and your own mention pill         | `errorForeground`, `editorError.foreground`                                   |
| Success                                  | `gitDecoration.untrackedResourceForeground`, `editorGutter.addedBackground`   |
| Information                              | `gitDecoration.modifiedResourceForeground`, `editorGutter.modifiedBackground` |
| User name and avatar colors              | Token colors of `string`, `entity.name.tag`, `variable.member`, `constant.numeric`, `string.regexp` and `keyword` |

The gray scale of Element goes in steps from `editor.background` to the secondary text color, and then to the main text color.

### Readability

The script changes some colors so that text stays readable. In a dark theme it makes a color lighter. In a light theme it makes a color darker.

- Colored text, links and solid buttons have a contrast of at least 4.5:1 against the timeline and the room list.
- The error color has a contrast of at least 5.5:1, so that the text on your own mention pill is easy to read.
- Secondary text has a contrast of at least 4.5:1 on subtle backgrounds.
- Main text has a contrast of at least 4.5:1 on selected rows.

The ayu dark and mirage colors already pass these limits, so most of them do not change.
In Ayu Light, the orange accent `#f29718` becomes `#a26510` for text and buttons.

After the script writes the file, it shows the contrast of the main color pairs.
It marks a pair with `LOW` if the contrast is less than 4.5:1.

## install-theme.mjs

Adds themes to the `setting_defaults.custom_themes` list in an Element `config.json` file.

```sh
node install-theme.mjs [theme.json...] [--all [dir]] [--config <path>]
```

| Option            | Description                                                                          |
| ----------------- | ------------------------------------------------------------------------------------ |
| `theme.json`      | Theme files to install.                                                              |
| `--all [dir]`     | Install every `*.theme.json` file in `dir`. Default `dir`: the folder of the script. |
| `--config <path>` | The Element `config.json` file to change. See the default paths below.               |
| `-h`, `--help`    | Show the usage and exit.                                                             |

Give at least one theme file or `--all`. You can use both together.

Default `config.json` of Element Desktop:

| System  | Path                                                |
| ------- | --------------------------------------------------- |
| Windows | `%APPDATA%\Element\config.json`                     |
| macOS   | `~/Library/Application Support/Element/config.json` |
| Linux   | `~/.config/Element/config.json`                     |

What the script does:

1. It reads the theme files and `config.json`.
2. If a theme has the same name as an entry in the list, it replaces that entry. If not, it adds the theme at the end of the list.
3. It copies the old file to `config.json.bak`.
4. It writes `config.json` with the same indentation as before. All other settings stay the same.

If `config.json` does not exist, the script makes a new file.
If the folder of `config.json` does not exist, the script stops with an error.

## install-font.mjs

Installs or removes Iosevka for the current user. Administrator rights are not necessary.

```sh
node install-font.mjs [--version <version>] [--all-styles] [--force] [--dry-run]
node install-font.mjs --uninstall [--dry-run]
```

| Option                | Description                                                                           |
| --------------------- | ------------------------------------------------------------------------------------- |
| `--version <version>` | The Iosevka version to install, for example `34.9.0`. Default: the latest release.    |
| `--all-styles`        | Install all weights, widths and slopes. Default: only the 8 styles that Element uses. |
| `--force`             | Replace font files that are already installed.                                        |
| `--uninstall`         | Remove all `Iosevka-*.ttf` files from the font folder of the current user.            |
| `--dry-run`           | Show the files to install or remove. Change nothing.                                  |
| `-h`, `--help`        | Show the usage and exit.                                                              |

The 8 styles that Element uses are Regular, Medium, SemiBold and Bold, each upright and italic.

Font folder of the current user:

| System  | Font folder                              |
| ------- | ---------------------------------------- |
| Windows | `%LOCALAPPDATA%\Microsoft\Windows\Fonts` |
| macOS   | `~/Library/Fonts`                        |
| Linux   | `~/.local/share/fonts/Iosevka`           |

### Install

1. The script gets the release data from [github.com/be5invis/Iosevka](https://github.com/be5invis/Iosevka/releases).
2. It downloads `PkgTTF-Iosevka-<version>.zip` to a temporary folder. This file is large: version 34.9.0 is 177 MB.
3. It unpacks the archive and selects the font files.
4. It copies the font files to the font folder.
    - On Windows, it also registers each font in `HKCU\Software\Microsoft\Windows NT\CurrentVersion\Fonts`.
      It then loads the fonts, so apps that start after the script can use them.
    - On Linux, it runs `fc-cache` to update the font cache.
5. It deletes the temporary folder.

The script skips font files that are already installed. Use `--force` to replace them.
With `--dry-run`, the script still downloads and unpacks the archive, then shows the files.

### Uninstall

```sh
npm run font:uninstall
```

1. On Windows, the script removes the registry entries of the `Iosevka-*.ttf` files and unloads the fonts.
2. It deletes the `Iosevka-*.ttf` files from the font folder.
3. On Linux, it deletes the empty `Iosevka` folder and runs `fc-cache`.

Restart Element after you remove the font.

On Windows, an open app can keep a font file in use. Then the script cannot delete or replace the file.
Close the apps that use Iosevka and run the script again.

## Notes

- Element uses the same color for the background, hover and press state of a mention pill if a theme sets `other-user-pill-bg-color`.
  These themes do not set it, so mention pills use the accent color and change color on hover.

## Credits

- Colors: [ayu](https://github.com/ayu-theme/vscode-ayu), MIT license.
- Font: [Iosevka](https://github.com/be5invis/Iosevka) by Belleve Invis, SIL Open Font License 1.1.
  This project does not include the font files. `install-font.mjs` downloads them from the official releases.

## License

MIT
