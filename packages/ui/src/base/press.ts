// tokens.json motion.press: "scale 0.97, spring damping 18 stiffness 300".
// One place so Button, Chip and Switch cannot drift apart.
export const PRESS_SPRING = { type: 'spring', damping: 18, stiffness: 300 } as const;
export const PRESS_SCALE = 0.97;
