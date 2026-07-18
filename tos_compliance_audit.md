# System Terms of Service (TOS) Compliance Audit
**Scope:** `reel-flow` (Frontend), `backend` (Node/Express API)
**Audit Type:** TOS Compliance (AdMob, YouTube API, Google Play Store)
**Objective:** Identify direct violations, risks, and non-compliant implementations in the system's monetization and reward flows.

---

## 1. YouTube API Services TOS Compliance

**Status:** 🚨 **CRITICAL VIOLATION**

### A. Incentivized Views (Section II.3 Prohibitions)
- **Violation:** YouTube's API Terms of Service strictly prohibit offering incentives, rewards, or compensation to users for interacting with YouTube features (e.g., watching a video).
- **Evidence:** 
  - In the frontend (`ShortItem.tsx`), there is a timer (`COIN_REWARD_WATCH_SECONDS` = 8s) that triggers `claimShortReward` after a user watches a YouTube Short for 8 seconds.
  - In the backend (`rewardsController.ts` -> `claimShortReward`), the system reads `short_watch_reward_coins` from the database and mints coins to the user's ledger (`SHORT_WATCH`) for simply watching the YouTube video. 
- **Risk:** Immediate revocation of YouTube API keys and blacklisting of the app if detected by YouTube.

### B. Obscuring the Player (Section II.3 Prohibitions)
- **Violation:** YouTube requires that the player and its controls remain fully visible and unobstructed.
- **Evidence:** `ShortItem.tsx` layers a `gestureZone` interceptor over the top 80% of the player to handle double-taps (likes) and pauses. It also overlays a `pausedOverlay` (play button icon) and a `likeBurst` animation directly on top of the iframe. While the code comments note an attempt to leave the bottom 20% clear for the YouTube logo ("TOS compliance"), overlaying the actual video content with custom interceptors and UI elements still violates the strict prohibition against obscuring any part of the player.

---

## 2. Google AdMob TOS Compliance

**Status:** 🟡 **MODERATE RISK (Mitigated by Architecture)**

### A. Monetizing Copyrighted/Third-Party Content
- **Current Architecture:** You have correctly used the official YouTube API for embedding, which is permitted by YouTube. Furthermore, the ads are not overlaid on the videos themselves, but are placed as distinct, separate cards (`REWARDED_VIDEO_CARD` and `REWARDED_INTERSTITIAL_TRIGGER`) within the app's feed.
- **Risk Assessment:** Because the ads are physically separated from the YouTube iframe and presented as app-level rewards rather than pre-roll or overlay ads on the copyrighted content, you avoid the most severe AdMob violations regarding copyright monetization. However, AdMob can sometimes flag apps if their *sole* primary value is curating third-party content. Since you have added a News/Discover feed and Games, this risk is reasonably mitigated.

### B. Valid Implementation of Rewarded Ads
- **Compliant Aspect:** The implementation of the AdMob Rewarded SDK itself is well done. The app correctly uses Server-Side Verification (SSV) in `rewardsController.ts` (`handleAdMobSSV`) to prevent client-side spoofing, checks daily caps, and provides clear opt-in language ("Watch & Earn X coins") which is permitted *specifically* for Rewarded ad formats. 

---

## 3. Google Play Store TOS Compliance

**Status:** 🚨 **CRITICAL VIOLATION**

### A. Real-Money Gambling, Games, and Contests Policy
- **Violation:** Apps that offer games of chance in exchange for real-world monetary value (or virtual currency that can be cashed out for real money) are classified as Real-Money Gambling. These apps are banned in most countries on the Play Store unless the developer holds a valid government gambling license.
- **Evidence:** 
  - The backend (`rewardsController.ts`) contains `claimRouletteSpin`, which is a game of chance (randomly selecting a slice based on probability weights) that rewards users with coins. 
  - Users can earn extra roulette spins by watching ads (`ROULETTE_AD`).
  - In `walletController.ts`, users can withdraw these coins for real-world currency (INR, UPI transfers, or Vouchers).
- **Risk:** Because chance determines a real-world financial outcome, Google Play will immediately suspend the app for violating the Gambling policy unless explicitly licensed and geofenced.

### B. Spam / Minimum Functionality / Ad Fraud
- **Risk:** Google Play heavily penalizes "cash reward" apps whose sole purpose is ad arbitrage (forcing users to watch ads for a cut of the revenue) without providing inherent utility.
- **Evidence:** The app's core loop consists of users watching videos and ads to mint coins, then withdrawing those coins as INR. If the app is perceived as an "ad farming" tool (even with the backend penalty systems in place), it risks being removed under the "Deceptive Behavior" or "Spam" policies.

---

## Summary of Required Actions (To Become Compliant)

1. **Remove YouTube Watch Rewards:** Stop granting coins/XP for watching YouTube videos immediately. YouTube videos can be in the app, but watch-time cannot be tied to the virtual economy.
2. **Remove Roulette Wheel:** Remove the `claimRouletteSpin` feature entirely to avoid the Real-Money Gambling classification, or decouple it completely from the withdrawable coin economy.
3. **Remove UI Overlays from YouTube Player:** Remove the `gestureZone` interceptor and custom play/pause overlays from the YouTube iframe in `ShortItem.tsx`.
4. **Monitor AdMob Performance:** Since you have correctly separated ads into distinct cards rather than overlaying them on videos, you are in a much safer position. Just monitor the AdMob policy center, as automated systems sometimes flag apps that heavily rely on third-party content, even when embedded correctly.
