// react-native is not installed for the type check; these are the types
// react-native.d.ts uses.
declare module 'react-native' {
  export type ViewStyle = Record<string, unknown>;
  export type StyleProp<T> = T | T[] | null | undefined | false;
}
