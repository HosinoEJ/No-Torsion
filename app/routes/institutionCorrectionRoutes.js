const express = require('express');
const {
  applySensitivePageHeaders,
  createRateLimiter,
  sensitiveRobotsPolicy
} = require('../../config/security');
const {
  buildGoogleFormPrefillUrl,
  encodeGoogleFormFields,
  submitToGoogleForm
} = require('../services/formService');
const { validateFormProtection } = require('../services/formProtectionService');
const {
  buildInstitutionCorrectionGoogleFormFields,
  InstitutionCorrectionStorageUnavailableError,
  saveInstitutionCorrectionSubmission,
  validateInstitutionCorrectionSubmission
} = require('../services/institutionCorrectionService');
const { logAuditEvent } = require('../services/auditLogService');
const {
  buildSubmissionDiagnostics,
  getSubmitTargets,
  shouldBuildGoogleFallbackUrl
} = require('../services/submissionTargetService');

function normalizeInstitutionCorrectionTargetError({ error, req }) {
  if (error instanceof InstitutionCorrectionStorageUnavailableError) {
    return {
      error: req.t('institutionCorrection.errors.storageUnavailable'),
      reasonCode: 'storage_unavailable'
    };
  }

  return {
    error: error && error.message
      ? error.message
      : req.t('institutionCorrection.errors.submitFailed'),
    reasonCode: 'submit_failed'
  };
}

function buildInstitutionCorrectionFailureStatusCode(resultsByTarget) {
  const failedTargetResults = Object.values(resultsByTarget || {}).filter((result) => !result?.ok);

  if (
    failedTargetResults.length > 0
    && failedTargetResults.every((result) => result.reasonCode === 'storage_unavailable')
  ) {
    return 503;
  }

  return 500;
}

async function submitInstitutionCorrectionToConfiguredTargets({
  correctionGoogleFormUrl,
  correctionSubmitTarget,
  encodedPayload,
  req,
  values
}) {
  const targets = getSubmitTargets(correctionSubmitTarget);
  const settledResults = await Promise.allSettled(targets.map(async (target) => {
    if (target === 'google') {
      await submitToGoogleForm(correctionGoogleFormUrl, encodedPayload);
      return {
        target
      };
    }

    const storageResult = await saveInstitutionCorrectionSubmission({ req, values });
    return {
      target,
      bindingName: storageResult.bindingName,
      submissionId: storageResult.submissionId
    };
  }));
  const resultsByTarget = Object.create(null);
  const successfulTargets = [];

  settledResults.forEach((result, index) => {
    const target = targets[index];

    if (result.status === 'fulfilled') {
      successfulTargets.push(target);
      resultsByTarget[target] = {
        ok: true,
        bindingName: result.value?.bindingName || '',
        submissionId: result.value?.submissionId || ''
      };
      return;
    }

    resultsByTarget[target] = {
      ok: false,
      ...normalizeInstitutionCorrectionTargetError({
        error: result.reason,
        req
      })
    };
  });

  return {
    resultsByTarget,
    successfulTargets
  };
}

function renderInstitutionCorrectionFailurePage({
  correctionGoogleFormUrl,
  correctionSubmitTarget,
  encodedPayload,
  errorMessage,
  req,
  res,
  showSubmissionDiagnostics,
  statusCode,
  submissionDiagnostics,
  title
}) {
  return res.status(statusCode).render('institution_correction_submit_error', {
    backFormUrl: '/map/correction',
    errorMessage,
    fallbackUrl: shouldBuildGoogleFallbackUrl({
      submitTarget: correctionSubmitTarget,
      googleFormUrl: correctionGoogleFormUrl,
      encodedPayload
    })
      ? buildGoogleFormPrefillUrl(correctionGoogleFormUrl, encodedPayload)
      : '',
    pageRobots: sensitiveRobotsPolicy,
    showSubmissionDiagnostics,
    submissionDiagnostics,
    title: req.t('pageTitles.institutionCorrectionError', { title })
  });
}

function createInstitutionCorrectionRoutes({
  correctionGoogleFormUrl,
  correctionSubmitTarget,
  debugMod,
  formProtectionMaxAgeMs,
  formProtectionMinFillMs,
  formProtectionSecret,
  rateLimitRedisUrl,
  submitRateLimitMax,
  title
}) {
  const router = express.Router();
  const showSubmissionDiagnostics = debugMod === 'true';
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

  router.post(['/map/correction/submit', '/correction/submit'], submitLimiter, async (req, res) => {
    applySensitivePageHeaders(res);
    logAuditEvent(req, 'institution_correction_received', {
      submitTarget: correctionSubmitTarget
    });

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

    let encodedPayload = '';

    try {
      const fields = buildInstitutionCorrectionGoogleFormFields(values, req.t);
      encodedPayload = encodeGoogleFormFields(fields);

      const submissionResult = await submitInstitutionCorrectionToConfiguredTargets({
        correctionGoogleFormUrl,
        correctionSubmitTarget,
        encodedPayload,
        req,
        values
      });
      const submissionDiagnostics = buildSubmissionDiagnostics({
        req,
        resultsByTarget: submissionResult.resultsByTarget,
        successfulTargets: submissionResult.successfulTargets
      });

      if (submissionResult.successfulTargets.length === 0) {
        const statusCode = buildInstitutionCorrectionFailureStatusCode(submissionResult.resultsByTarget);
        const errorMessage = statusCode === 503
          ? req.t('institutionCorrection.errors.storageUnavailable')
          : req.t('institutionCorrection.errors.submitFailed');

        logAuditEvent(req, 'institution_correction_submit_failed', {
          failedTargets: submissionDiagnostics.failedTargets.map((target) => target.id),
          status: statusCode
        });

        return renderInstitutionCorrectionFailurePage({
          correctionGoogleFormUrl,
          correctionSubmitTarget,
          encodedPayload,
          errorMessage,
          req,
          res,
          showSubmissionDiagnostics,
          statusCode,
          submissionDiagnostics,
          title
        });
      }

      logAuditEvent(req, 'institution_correction_submit_succeeded', {
        failedTargets: submissionDiagnostics.failedTargets.map((target) => target.id),
        status: 200,
        successfulTargets: submissionDiagnostics.successfulTargets.map((target) => target.id)
      });

      return res.render('institution_correction_submit', {
        pageRobots: sensitiveRobotsPolicy,
        showSubmissionDiagnostics,
        submissionDiagnostics,
        title: req.t('pageTitles.institutionCorrectionSuccess', { title })
      });
    } catch (error) {
      const normalizedError = normalizeInstitutionCorrectionTargetError({ error, req });
      const statusCode = error instanceof InstitutionCorrectionStorageUnavailableError ? 503 : 500;

      logAuditEvent(req, 'institution_correction_submit_failed', {
        error: normalizedError.error,
        status: statusCode
      });
      console.error('Institution correction submit error:', error.message);

      return renderInstitutionCorrectionFailurePage({
        correctionGoogleFormUrl,
        correctionSubmitTarget,
        encodedPayload,
        errorMessage: normalizedError.error,
        req,
        res,
        showSubmissionDiagnostics,
        statusCode,
        submissionDiagnostics: buildSubmissionDiagnostics({
          req,
          resultsByTarget: Object.fromEntries(
            getSubmitTargets(correctionSubmitTarget).map((target) => [target, {
              ok: false,
              ...normalizedError
            }])
          ),
          successfulTargets: []
        }),
        title
      });
    }
  });

  return router;
}

module.exports = createInstitutionCorrectionRoutes;
