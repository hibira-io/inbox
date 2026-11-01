// Resolves react-native to the stub in this folder, so react-native.js
// loads in Node.
import { register } from 'node:module';
register(new URL('./hooks.mjs', import.meta.url));
