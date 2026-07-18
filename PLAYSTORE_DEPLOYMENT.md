# Play Store Deployment Guide

This guide covers the process for building and deploying your React Native (Expo) app to the Google Play Store. 

## Version 1 Preparation Completed

We have already completed the following steps to prepare your app for Version 1 deployment:

1. **Updated `app.json`**:
   - Ensured the `android.package` is set to `com.ascend.reelsapp`.
   - Added `versionCode: 1`. This number must be incremented for every future update sent to the Play Store.

2. **Configured Release Signing**:
   - Generated a production keystore (`android/app/release.keystore`).
   - Updated `android/app/build.gradle` to include the `release` signing configuration. 
   - This ensures the generated Android App Bundle (.aab) is cryptographically signed and accepted by Google Play.

## Generating the Android App Bundle (AAB)

To upload the app to the Play Console, you need an AAB file. 
You can generate the AAB using either the local Gradle wrapper (which we are running now) or Expo Application Services (EAS).

### Method 1: Local Build (Gradle)

If you have your Android development environment fully set up locally, you can build the bundle without relying on Expo servers:

```bash
cd android
./gradlew bundleRelease
```

The output file will be located at: 
`android/app/build/outputs/bundle/release/app-release.aab`

Upload this file directly to the Google Play Console in your Internal Testing or Production track.

### Method 2: Expo Application Services (EAS) Build

The easiest method for future updates is using EAS Build, as it handles the native environment and signing in the cloud.

1. Install EAS CLI: `npm install -g eas-cli`
2. Log in to Expo: `eas login`
3. Start the build: `eas build --platform android --profile production`

EAS will generate a link to download the `.aab` file once the build succeeds. 
You can also use `eas submit --platform android` to automate the upload directly to the Play Console.

## Next Steps for Google Play Console

1. Go to the [Google Play Console](https://play.google.com/console/).
2. Create a new app (if you haven't already).
3. Set up the App Store Listing (Icon, screenshots, feature graphic, description).
4. Fill out the necessary declarations (Data Safety, Ads, Content Rating).
5. Navigate to **Testing > Internal testing** or **Production**.
6. Create a new release and upload the `.aab` file.
7. Roll out the release!
