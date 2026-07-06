type FontVariable = { variable: string };

function fontVariable(variable: string): FontVariable {
  return { variable };
}

// Keep font CSS variable hooks stable without making production builds depend on
// Google Fonts fetches at compile time. The actual font stacks and fallbacks are
// defined in app/globals.css.
export const jakarta = fontVariable("font-jakarta");
export const outfit = fontVariable("font-outfit");
export const spaceGrotesk = fontVariable("font-space-grotesk");
export const bebasNeue = fontVariable("font-brand");
export const kalam = fontVariable("font-najs");
export const patrickHand = fontVariable("font-patrick");
export const caveat = fontVariable("font-caveat");
