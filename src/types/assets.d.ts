/**
 * Metro asset modules: numeric ids on native, bundled URL strings on web.
 * Blender-authored models ship as GLB (see docs/05-blender-pipeline.md).
 */
declare module '*.glb' {
  const asset: number | string;
  export default asset;
}
