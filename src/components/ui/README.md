# SquatSense UI

Wrap the app once in `ThemeProvider` from `src/theme`. It loads bundled Inter and IBM Plex Sans Thai regular, medium, semibold, and bold faces with `expo-font`. While loading it shows a dark loading view; a load failure falls back to system fonts. There are no remote font requests. This runtime approach also works in Expo Go.

Import components from `src/components/ui` and tokens from `src/theme`. Tokens cover the palette in `AGENTS.md`, typography, spacing, radius, touch sizes, and interaction opacity. Card radii are 16–20 logical units; only the primary blue is a decorative accent. Success/warning/error colors are for form feedback.

| Component | Main props |
| --- | --- |
| `PrimaryButton` | `label`, optional `icon`, native touch props including `onPress`, `disabled`, `testID`, `style` |
| `SecondaryButton` | Same; icon-only buttons require `icon` and `accessibilityLabel` |
| `StatCard` | `label`, `value` (string/number/null), optional `icon`; null renders `--`, zero stays `0` |
| `StatusChip` | `label`, optional `tone`: neutral (default), success, warning, error |
| `SectionCard` | `children`, optional `title`, native View props and `style` |
| `AppHeader` | `title`, optional `subtitle`, `icon`, `settingsAction` slot |
| `AppText` | Native Text props plus `variant`, `weight`, and optional `language` (`en` or `th`) |

All text-bearing components accept `language`. `AppText` automatically selects IBM Plex Sans Thai when children contain Thai text, including mixed Thai/English strings. Explicit language is useful for numeric-only Thai labels. Static font faces are selected by weight; `fontWeight: normal` is applied with loaded faces to avoid Android synthetic-weight fallback. Font sizes continue to respect system scaling.

Buttons forward the supplied handlers and disabled/accessibility state and have a minimum 48-unit touch target. Components never calculate workout statistics, infer sensor status, or own navigation. Supply real values and statuses; use `null` for an unavailable stat. Status chips use visible labels as well as color.

The header renders no settings button unless a real action is provided. For a future settings screen, supply a working control from the caller:

```tsx
<AppHeader
  title="SquatSense"
  subtitle="Biomechanics Motion Coach"
  settingsAction={
    <SecondaryButton
      label="Settings"
      onPress={openSettings}
    />
  }
/>
```

The existing app deliberately leaves this slot empty because no settings screen exists. Its dashboard, countdown, summary, and event handlers remain in `App.tsx`. Empty accuracy displays `--` as specified in `AGENTS.md`; the detector and accuracy formula are unchanged.
