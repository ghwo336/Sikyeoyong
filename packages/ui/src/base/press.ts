// tokens.json motion.press: "scale 0.97, spring damping 18 stiffness 300".
// One place so Button, Chip and Switch cannot drift apart. Nothing else builds its own
// pressed button: other areas use base Button or Chip (D-18 principle 5).
export const PRESS_SPRING = { type: 'spring', damping: 18, stiffness: 300 } as const;
export const PRESS_SCALE = 0.97;
/** The Motion whileTap target for a press. */
export const PRESS = { scale: PRESS_SCALE } as const;
