const APP_NAME = process.env.LEGAL_APP_NAME || 'ReelFlow';
const ENTITY_NAME = process.env.LEGAL_ENTITY_NAME || `${APP_NAME} (operated by the app developer)`;
const SUPPORT_EMAIL = process.env.LEGAL_SUPPORT_EMAIL || process.env.SUPPORT_EMAIL || 'support@example.com';
const LAST_UPDATED = process.env.LEGAL_LAST_UPDATED || new Date().toISOString().slice(0, 10);

const page = (title: string, body: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — ${APP_NAME}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 760px; margin: 0 auto; padding: 32px 20px 80px; color: #1a1a1a; background: #fff; }
  @media (prefers-color-scheme: dark) { body { color: #e8e8e8; background: #121212; } a { color: #7db8ff; } }
  h1 { font-size: 1.6rem; margin-bottom: 4px; }
  h2 { font-size: 1.15rem; margin-top: 2rem; }
  .updated { color: #777; font-size: 0.9rem; margin-bottom: 2rem; }
  ul { padding-left: 1.3rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #ccc4; padding: 8px 10px; text-align: left; font-size: 0.92rem; vertical-align: top; }
  code { background: #8884; padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }
</style>
</head>
<body>
<h1>${title}</h1>
<p class="updated">Last updated: ${LAST_UPDATED} · ${ENTITY_NAME}</p>
${body}
<hr style="margin-top:3rem;opacity:.3;">
<p style="font-size:.85rem;color:#888;">Questions about this ${title.toLowerCase()}? Contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
</body>
</html>`;

export const privacyPolicyHtml = () => page('Privacy Policy', `
<p>${ENTITY_NAME} ("we", "us", "${APP_NAME}") operates the ${APP_NAME} mobile app (the "App"), which lets you watch short videos and news, complete missions, and earn virtual rewards ("coins") redeemable for gift vouchers, physical items, or cash-equivalent payouts. This policy explains what data we collect, why, and the choices you have.</p>

<h2>1. Information We Collect</h2>
<table>
<tr><th>Category</th><th>Examples</th><th>Source</th></tr>
<tr><td>Account &amp; profile</td><td>Name, email address, profile identifier</td><td>Google Sign-In, provided directly by you</td></tr>
<tr><td>Device &amp; security signals</td><td>Device identifier hash, OS version, root/emulator detection flag, IP address, timezone, advertising ID (GAID/IDFA)</td><td>Collected automatically, used for fraud and multi-account abuse prevention and ad personalization</td></tr>
<tr><td>Usage &amp; activity</td><td>Videos/articles viewed, watch time, missions completed, streaks, XP/level, in-app purchases of virtual items</td><td>Generated as you use the App</td></tr>
<tr><td>Rewards &amp; payout details</td><td>Coin balance and transaction history; when you redeem a reward: UPI ID / mobile number, delivery address, size/color for physical items</td><td>Provided by you when requesting a withdrawal or redemption</td></tr>
<tr><td>Push notification token</td><td>Firebase Cloud Messaging (FCM) device token</td><td>Collected automatically if you allow notifications</td></tr>
<tr><td>Support communications</td><td>Any information you include when contacting support</td><td>Provided directly by you</td></tr>
</table>

<h2>2. How We Use Information</h2>
<ul>
<li>To operate your account, track earned coins, and process reward redemptions and payouts.</li>
<li>To detect and prevent fraud, multiple-account abuse, and automated/bot activity (device fingerprinting, IP and risk scoring).</li>
<li>To serve and personalize ads through Google AdMob, and to verify ad-view completions before crediting rewards.</li>
<li>To send push notifications about rewards, missions, and account activity.</li>
<li>To provide customer support and respond to your requests.</li>
<li>To improve the App's features, stability, and content recommendations.</li>
<li>To comply with legal obligations and enforce our Terms of Service.</li>
</ul>

<h2>3. Third-Party Services</h2>
<p>The App integrates the following third-party services, each governed by its own privacy policy:</p>
<ul>
<li><strong>Google AdMob</strong> — serves in-app advertising and may use the advertising identifier for ad personalization, subject to your device's ad tracking settings.</li>
<li><strong>Google Sign-In / Firebase</strong> — used for authentication and (optionally) push notifications.</li>
<li><strong>YouTube (embedded player)</strong> — some video content is played via the official YouTube player embed; YouTube's own Terms of Service and Privacy Policy apply to that playback.</li>
</ul>
<p>We do not sell your personal information. We share data with these providers only as necessary for them to provide their service to us (e.g., serving an ad, authenticating your sign-in), and with payout/voucher fulfillment partners only as necessary to deliver a reward you requested.</p>

<h2>4. Your Choices &amp; Rights</h2>
<ul>
<li><strong>Delete your account:</strong> you can permanently delete your account and associated personal data at any time from Settings → Delete Account within the App.</li>
<li><strong>Ad personalization:</strong> you can limit ad tracking through your device's OS-level privacy settings (e.g., "Ask App Not to Track" / "Opt out of Ads Personalization").</li>
<li><strong>Notifications:</strong> you can disable push notifications in Settings or your device's notification settings.</li>
<li>You may request a copy of the personal data we hold about you, or its correction, by contacting us (see below).</li>
</ul>

<h2>5. Data Retention</h2>
<p>We retain account and transaction data for as long as your account is active and as needed to comply with legal, tax, and anti-fraud obligations (including after a withdrawal, to maintain a payout audit trail). Deleting your account removes your profile and personally-identifying data from active systems; some records may be retained where required by law or legitimate fraud-prevention purposes.</p>

<h2>6. Children's Privacy</h2>
<p>The App is rated for a general audience 13 and older and is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us personal information, contact us and we will delete it.</p>

<h2>7. Security</h2>
<p>We use industry-standard measures to protect your data, including encrypted transport (HTTPS), signed API requests, and hashed device identifiers. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>

<h2>8. Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. Material changes will be reflected by updating the "Last updated" date above, and where required, notified in-app.</p>
`);

export const termsOfServiceHtml = () => page('Terms &amp; Conditions', `
<p>These Terms &amp; Conditions ("Terms") govern your use of the ${APP_NAME} mobile app (the "App"), operated by ${ENTITY_NAME}. By creating an account or using the App, you agree to these Terms.</p>

<h2>1. Eligibility</h2>
<p>You must be at least 13 years old to use the App. If you are under the age of majority in your jurisdiction, you confirm you have permission from a parent or guardian to use the App and any associated reward redemption.</p>

<h2>2. Your Account</h2>
<p>You sign in using Google Sign-In. You are responsible for maintaining the security of your account and for all activity under it. One account per person; creating multiple accounts to farm rewards is prohibited (see §5).</p>

<h2>3. Virtual Coins &amp; Rewards</h2>
<ul>
<li>Coins earned in the App are a virtual, in-app unit with no monetary value on their own. They are not currency, are not transferable between accounts, and cannot be purchased with real money.</li>
<li>Coins may be redeemed for gift vouchers, physical merchandise, or a cash-equivalent payout, subject to configured exchange rates, minimum thresholds, and available catalog items, all of which may change at any time.</li>
<li>All redemptions are subject to review and may be delayed, held, or declined where we detect fraud, abuse, or a violation of these Terms. Coins obtained through fraudulent means may be revoked.</li>
<li>Rewards are earned for genuine engagement with sponsored content (advertisements) and completed missions/offers — not as payment for viewing any specific third-party video platform's content.</li>
</ul>

<h2>4. Advertising</h2>
<p>The App is supported by advertising served through Google AdMob, including rewarded video ads. Ad availability is not guaranteed and may vary by region, time, and inventory.</p>

<h2>5. Prohibited Conduct</h2>
<p>You agree not to:</p>
<ul>
<li>Use bots, scripts, emulators, rooted/jailbroken devices, VPN/IP spoofing, or any automated means to interact with the App or claim rewards;</li>
<li>Create or operate multiple accounts to claim rewards, referral bonuses, or promotions intended for a single person;</li>
<li>Interfere with, disable, or obscure third-party embedded content or its native controls;</li>
<li>Attempt to reverse-engineer, tamper with, or exploit the App's reward, fraud-detection, or payment systems.</li>
</ul>
<p>Violations may result in a warning, shadow-ban, permanent account suspension, and forfeiture of unredeemed coins, at our discretion.</p>

<h2>6. Third-Party Content</h2>
<p>The App displays third-party content including embedded YouTube videos, syndicated news articles, and third-party HTML5 games. We do not own this content; it remains the property of its respective owners and is subject to their own terms.</p>

<h2>7. Termination</h2>
<p>We may suspend or terminate your access to the App at any time for violation of these Terms, suspected fraud, or as required by law. You may stop using the App and delete your account at any time from within Settings.</p>

<h2>8. Disclaimers &amp; Limitation of Liability</h2>
<p>The App is provided "as is" without warranties of any kind. To the maximum extent permitted by law, ${ENTITY_NAME} is not liable for indirect, incidental, or consequential damages arising from your use of the App, including delays or failures in reward delivery due to third-party payment/voucher processors outside our control.</p>

<h2>9. Changes to These Terms</h2>
<p>We may update these Terms from time to time. Continued use of the App after a change constitutes acceptance of the updated Terms.</p>

<h2>10. Contact</h2>
<p>For questions about these Terms, contact us at the email below.</p>
`);
