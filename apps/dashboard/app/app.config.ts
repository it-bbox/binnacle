// The mockup's soft backgrounds and lines for warning and error (main.css), where Nuxt UI's soft,
// subtle and outline variants would mix the colour with transparency. Success has none in the mockup.
const warningAndError = [
  { color: 'warning', variant: 'soft', class: 'bg-(--warn-soft)' },
  { color: 'warning', variant: 'subtle', class: 'bg-(--warn-soft) ring-(--warn-line)' },
  { color: 'warning', variant: 'outline', class: 'ring-(--warn-line)' },
  { color: 'error', variant: 'soft', class: 'bg-(--err-soft)' },
  { color: 'error', variant: 'subtle', class: 'bg-(--err-soft)' },
] as const;

export default defineAppConfig({
  ui: {
    badge: {
      // Nuxt UI sets its small badges in 8 and 10 px; the type scale's floor is xs (main.css).
      variants: { size: { xs: { base: 'text-xs/4' }, sm: { base: 'text-xs/4' } } },
      compoundVariants: [
        ...warningAndError,
        // The mockup's quiet badges sit on --chip; Nuxt UI would put them on the hover shade.
        { color: 'neutral', variant: 'soft', class: 'bg-accented' },
        { color: 'neutral', variant: 'subtle', class: 'bg-accented' },
      ],
    },
    // A warning's icon is the mockup's --warn, beside its text in --warn-text.
    alert: { compoundVariants: warningAndError.map(({ class: root, ...variant }) => ({ ...variant, class: { root, ...(variant.color === 'warning' ? { icon: 'text-(--warn)' } : {}) } })) },
    // A dot in the warning colour is the mockup's --warn, not the text shade.
    chip: { variants: { color: { warning: 'bg-(--warn)' } } },
  },
});
