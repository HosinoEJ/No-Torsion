const express = require('express');
const { createSubmitRateLimiter } = require('../../config/security');
const {
  buildGoogleFormFields,
  encodeGoogleFormFields,
  submitToGoogleForm,
  validateSubmission
} = require('../services/formService');
const { logAuditEvent } = require('../services/auditLogService');

// 表單提交流程：限流 -> 校验 -> 干跑预览或真实提交 -> 审计日志。
function createFormRoutes({ formDryRun, googleFormUrl, submitRateLimitMax, title }) {
  const router = express.Router();
  const submitLimiter = createSubmitRateLimiter({
    max: submitRateLimitMax,
    getMessage(req) {
      return req.t('server.tooManyRequests');
    },
    onLimit(req, status, message) {
      logAuditEvent(req, 'submit_rate_limited', { status, message });
    }
  });

  router.post('/submit', submitLimiter, async (req, res) => {
    // 每次进入提交路由都先记录一条审计日志，便于后续排查来源 IP 和路径。
    logAuditEvent(req, 'submit_received', { dryRun: formDryRun });

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
      const encodedPayload = encodeGoogleFormFields(fields);

      // 干跑模式下直接渲染预览页，不真正请求 Google。
      if (formDryRun) {
        logAuditEvent(req, 'submit_preview_rendered', {
          fieldCount: fields.length,
          status: 200
        });
        return res.render('submit_preview', {
          title: req.t('pageTitles.submitPreview', { title }),
          googleFormUrl,
          fields,
          encodedPayload
        });
      }

      // 正常模式下把整理后的 payload 发送到 Google Form。
      await submitToGoogleForm(googleFormUrl, encodedPayload);
      logAuditEvent(req, 'submit_succeeded', {
        fieldCount: fields.length,
        status: 200
      });
      return res.render('submit', {
        title
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

  return router;
}

module.exports = createFormRoutes;
