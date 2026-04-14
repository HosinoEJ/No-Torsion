function getTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getSubmitTargets(submitTarget) {
  if (submitTarget === 'both') {
    return ['google', 'd1'];
  }

  if (submitTarget === 'd1') {
    return ['d1'];
  }

  return ['google'];
}

function shouldBuildGoogleFallbackUrl({ submitTarget, googleFormUrl, encodedPayload }) {
  return submitTarget !== 'd1'
    && Boolean(getTrimmedString(googleFormUrl))
    && Boolean(getTrimmedString(encodedPayload));
}

function buildSubmissionDiagnostics({ req, resultsByTarget, successfulTargets = [] }) {
  const targetLabels = {
    d1: req.t('submitStatus.targets.d1'),
    google: req.t('submitStatus.targets.google')
  };
  const attemptedTargetIds = Object.keys(resultsByTarget);

  return {
    attemptedTargets: attemptedTargetIds.map((target) => ({
      id: target,
      label: targetLabels[target] || target
    })),
    successfulTargets: successfulTargets.map((target) => ({
      id: target,
      label: targetLabels[target] || target
    })),
    failedTargets: attemptedTargetIds
      .filter((target) => !successfulTargets.includes(target))
      .map((target) => ({
        id: target,
        label: targetLabels[target] || target,
        error: resultsByTarget[target]?.error || '',
        reasonCode: resultsByTarget[target]?.reasonCode || ''
      }))
  };
}

function redactGoogleFormUrl(googleFormUrl) {
  const normalizedUrl = getTrimmedString(googleFormUrl);

  if (!normalizedUrl) {
    return '';
  }

  return normalizedUrl.replace(/\/d\/e\/([^/]+)\//, (_match, formId) => {
    const visiblePrefix = formId.slice(0, 4);
    const visibleSuffix = formId.slice(-4);
    return `/d/e/${visiblePrefix}...${visibleSuffix}/`;
  });
}

module.exports = {
  buildSubmissionDiagnostics,
  getSubmitTargets,
  redactGoogleFormUrl,
  shouldBuildGoogleFallbackUrl
};
