import { Router } from 'express';
import { privacyPolicyHtml, termsOfServiceHtml } from '../content/legalContent';

const router = Router();

// Public, unsigned, unauthenticated — must be reachable by a plain browser
// (Play Console review, users tapping the in-app link) so this cannot sit
// behind verifyApiSignature like the rest of the API.
router.get('/privacy-policy', (req, res) => {
  res.type('html').send(privacyPolicyHtml());
});

router.get('/terms', (req, res) => {
  res.type('html').send(termsOfServiceHtml());
});

export default router;
