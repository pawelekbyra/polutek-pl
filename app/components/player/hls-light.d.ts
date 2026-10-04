// hls.js ships the light build (dist/hls.light.mjs) without its own .d.ts; its API is the
// same class as the full build, minus features we don't use (subtitles in HLS, alt audio, EME).
declare module 'hls.js/light' {
  export * from 'hls.js';
  export { default } from 'hls.js';
}
