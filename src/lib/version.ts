/**
 * The app version shown in the UI.
 *
 * Read straight from `app.json` rather than through `expo-constants`: a dev
 * server snapshots the manifest when it starts, so `Constants.expoConfig.version`
 * goes stale the moment the version is bumped. Importing the file means there is
 * exactly one place to edit and the label always matches the code in front of
 * you. Never hard-code a version in a component.
 */
import appJson from '../../app.json';

export const APP_VERSION: string = appJson.expo.version;
