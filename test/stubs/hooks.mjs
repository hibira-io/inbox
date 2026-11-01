const stubs = { 'react-native': new URL('./react-native.mjs', import.meta.url).href };
export async function resolve(specifier, context, next) {
  if (stubs[specifier]) return { url: stubs[specifier], shortCircuit: true };
  return next(specifier, context);
}
