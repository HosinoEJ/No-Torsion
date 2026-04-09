const express = require('express');
const {
  applySensitivePageHeaders,
  createRateLimiter,
  createSubmitRateLimiter,
  sensitiveRobotsPolicy
} = require('../../config/security');
const {
  buildConfirmationFields,
  buildGoogleFormFields,
  encodeGoogleFormFields,
  submitToGoogleForm,
  validateSubmission
} = require('../services/formService');
const {
  issueFormConfirmationToken,
  validateFormConfirmation
} = require('../services/formConfirmationService');
const { validateFormProtection } = require('../services/formProtectionService');
const { logAuditEvent } = require('../services/auditLogService');

function encodeConfirmationPayload(encodedPayload) {
  return Buffer.from(String(encodedPayload || ''), 'utf8').toString('base64url');
}

function decodeConfirmationPayload(payload) {
  return Buffer.from(String(payload || '').trim(), 'base64url').toString('utf8');
}

function redactGoogleFormUrl(googleFormUrl) {
  const normalizedUrl = String(googleFormUrl || '').trim();

  if (!normalizedUrl) {
    return '';
  }

  return normalizedUrl.replace(/\/d\/e\/([^/]+)\//, (_match, formId) => {
    const visiblePrefix = formId.slice(0, 4);
    const visibleSuffix = formId.slice(-4);
    return `/d/e/${visiblePrefix}...${visibleSuffix}/`;
  });
}

// 表單提交流程：限流 -> 校验 -> 干跑预览或确认页 -> 最终提交 -> 审计日志。
function createFormRoutes({
  formDryRun,
  formProtectionMaxAgeMs,
  formProtectionMinFillMs,
  formProtectionSecret,
  googleFormUrl,
  rateLimitRedisUrl,
  submitRateLimitMax,
  title
}) {
  const router = express.Router();
  const submitLimiter = createSubmitRateLimiter({
    max: submitRateLimitMax,
    redisUrl: rateLimitRedisUrl,
    getMessage(req) {
      return req.t('server.tooManyRequests');
    },
    onLimit(req, status, message) {
      logAuditEvent(req, 'submit_rate_limited', { status, message });
    }
  });
  const confirmLimiter = createRateLimiter({
    max: submitRateLimitMax,
    redisUrl: rateLimitRedisUrl,
    storePrefix: 'submit-confirm-rate-limit:',
    getMessage(req) {
      return req.t('server.tooManyRequests');
    },
    onLimit(req, status, message) {
      logAuditEvent(req, 'submit_confirm_rate_limited', { status, message });
    }
  });

  router.post('/submit', submitLimiter, async (req, res) => {
    applySensitivePageHeaders(res);

    // 每次进入提交路由都先记录一条审计日志，便于后续排查来源 IP 和路径。
    logAuditEvent(req, 'submit_received', { dryRun: formDryRun });

    const protectionResult = validateFormProtection({
      token: req.body.form_token,
      honeypotValue: req.body.website,
      secret: formProtectionSecret,
      minFillMs: formProtectionMinFillMs,
      maxAgeMs: formProtectionMaxAgeMs
    });

    if (!protectionResult.ok) {
      logAuditEvent(req, 'submit_protection_failed', {
        ageMs: protectionResult.ageMs,
        reason: protectionResult.reason,
        status: 400
      });
      return res.status(400).send(req.t('server.invalidFormSubmission'));
    }

    try {
      // 先把请求体校验并规范化成 Google Form 需要的值。
      const { errors, values } = validateSubmission(req.body, req.t);
      if (errors.length > 0) {
        logAuditEvent(req, 'submit_validation_failed', {
          errorCount: errors.length,
          status: 400
        });
        return res.status(400).send(`${req.t('server.submitFailedPrefix')}${errors.join('；')}`);
      }

      const fields = buildGoogleFormFields(values, req.t);
      const confirmationFields = buildConfirmationFields(values, req.t);
      const encodedPayload = encodeGoogleFormFields(fields);

      // 干跑模式下直接渲染预览页，不真正请求 Google。
      if (formDryRun) {
        logAuditEvent(req, 'submit_preview_rendered', {
          fieldCount: fields.length,
          status: 200
        });
        return res.render('submit_preview', {
          title: req.t('pageTitles.submitPreview', { title }),
          googleFormUrl: redactGoogleFormUrl(googleFormUrl),
          fields,
          encodedPayload,
          pageRobots: sensitiveRobotsPolicy
        });
      }

      const confirmationPayload = encodeConfirmationPayload(encodedPayload);
      const confirmationToken = issueFormConfirmationToken({
        payload: confirmationPayload,
        secret: formProtectionSecret
      });
      logAuditEvent(req, 'submit_confirmation_rendered', {
        fieldCount: fields.length,
        status: 200
      });
      return res.render('submit_confirm', {
        pageRobots: sensitiveRobotsPolicy,
        title: req.t('pageTitles.submitConfirm', { title }),
        confirmationPayload,
        confirmationToken,
        fields: confirmationFields
      });
    } catch (error) {
      logAuditEvent(req, 'submit_failed', {
        error: error.message,
        status: 500
      });
      // 详细错误保留在服务端日志里，对外仍返回统一失败文案。
      console.error('Submission Error:', error.response ? error.response.data : error.message);
      return res.status(500).send(req.t('server.submitFailed'));
    }
  });

  router.post('/submit/confirm', confirmLimiter, async (req, res) => {
    applySensitivePageHeaders(res);

    logAuditEvent(req, 'submit_confirm_received', { dryRun: formDryRun });

    const confirmationPayload = String(req.body.confirmation_payload || '').trim();
    const confirmationToken = String(req.body.confirmation_token || '').trim();
    const confirmationResult = validateFormConfirmation({
      token: confirmationToken,
      payload: confirmationPayload,
      secret: formProtectionSecret,
      maxAgeMs: formProtectionMaxAgeMs
    });

    if (!confirmationResult.ok) {
      logAuditEvent(req, 'submit_confirm_validation_failed', {
        ageMs: confirmationResult.ageMs,
        reason: confirmationResult.reason,
        status: 400
      });
      return res.status(400).send(req.t('server.invalidFormSubmission'));
    }

    try {
      const encodedPayload = decodeConfirmationPayload(confirmationPayload);
      await submitToGoogleForm(googleFormUrl, encodedPayload);
      logAuditEvent(req, 'submit_succeeded', {
        status: 200
      });
      return res.render('submit', {
        pageRobots: sensitiveRobotsPolicy,
        title
      });
    } catch (error) {
      logAuditEvent(req, 'submit_failed', {
        error: error.message,
        status: 500
      });
      console.error('Submission Error:', error.response ? error.response.data : error.message);
      return res.status(500).send(req.t('server.submitFailed'));
    }
  });

  return router;
}

module.exports = createFormRoutes;
