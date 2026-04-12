const express = require('express');
const {
  applySensitivePageHeaders,
  createRateLimiter,
  sensitiveRobotsPolicy
} = require('../../config/security');
const { validateFormProtection } = require('../services/formProtectionService');
const {
  InstitutionCorrectionStorageUnavailableError,
  saveInstitutionCorrectionSubmission,
  validateInstitutionCorrectionSubmission
} = require('../services/institutionCorrectionService');
const { logAuditEvent } = require('../services/auditLogService');

function createInstitutionCorrectionRoutes({
  formProtectionMaxAgeMs,
  formProtectionMinFillMs,
  formProtectionSecret,
  rateLimitRedisUrl,
  submitRateLimitMax,
  title
}) {
  const router = express.Router();
  const submitLimiter = createRateLimiter({
    max: submitRateLimitMax,
    redisUrl: rateLimitRedisUrl,
    storePrefix: 'institution-correction-submit-rate-limit:',
    getMessage(req) {
      return req.t('server.tooManyRequests');
    },
    onLimit(req, status, message) {
      logAuditEvent(req, 'institution_correction_rate_limited', { status, message });
    }
  });

  router.post('/map/correction/submit', submitLimiter, async (req, res) => {
    applySensitivePageHeaders(res);
    logAuditEvent(req, 'institution_correction_received');

    const protectionResult = validateFormProtection({
      token: req.body.form_token,
      honeypotValue: req.body.website,
      secret: formProtectionSecret,
      minFillMs: formProtectionMinFillMs,
      maxAgeMs: formProtectionMaxAgeMs
    });

    if (!protectionResult.ok) {
      logAuditEvent(req, 'institution_correction_protection_failed', {
        ageMs: protectionResult.ageMs,
        reason: protectionResult.reason,
        status: 400
      });
      return res.status(400).send(req.t('server.invalidFormSubmission'));
    }

    const { errors, values } = validateInstitutionCorrectionSubmission(req.body, req.t);
    if (errors.length > 0) {
      logAuditEvent(req, 'institution_correction_validation_failed', {
        errorCount: errors.length,
        status: 400
      });
      return res.status(400).send(`${req.t('institutionCorrection.errors.submitFailedPrefix')}${errors.join('；')}`);
    }

    try {
      const saveResult = await saveInstitutionCorrectionSubmission({ req, values });
      logAuditEvent(req, 'institution_correction_saved', {
        bindingName: saveResult.bindingName,
        status: 200,
        submissionId: saveResult.submissionId
      });

      return res.render('institution_correction_submit', {
        pageRobots: sensitiveRobotsPolicy,
        title: req.t('pageTitles.institutionCorrectionSuccess', { title })
      });
    } catch (error) {
      if (error instanceof InstitutionCorrectionStorageUnavailableError) {
        logAuditEvent(req, 'institution_correction_storage_unavailable', { status: 503 });
        return res.status(503).send(req.t('institutionCorrection.errors.storageUnavailable'));
      }

      logAuditEvent(req, 'institution_correction_submit_failed', {
        error: error.message,
        status: 500
      });
      console.error('Institution correction submit error:', error.message);
      return res.status(500).send(req.t('institutionCorrection.errors.submitFailed'));
    }
  });

  return router;
}

module.exports = createInstitutionCorrectionRoutes;
