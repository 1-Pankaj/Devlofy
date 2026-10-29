/**
 * Metro asset modules: numeric ids on native, bundled URL strings on web.
 */
declare module '*.png' {
  const asset: number | string;
  export default asset;
}
