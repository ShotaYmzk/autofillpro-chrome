'use strict';

/**
 * 最終学歴と出身大学（学部）の入学・卒業年月を解決する。
 * i-web / Axol / e2R / FieldMatcher で共有する。
 */
const EducationDates = (() => {
  function isGradSchool(schoolType) {
    return /大学院/.test(String(schoolType || ''));
  }

  function resolve(education) {
    const e = education || {};
    const grad = isGradSchool(e.schoolType);

    const prior = {
      enrollYear: e.enrollYear || '',
      enrollMonth: e.enrollMonth || '',
      gradYear: e.gradYear || '',
      gradMonth: e.gradMonth || '',
    };

    const final = grad
      ? {
          enrollYear: e.gradSchoolEnrollYear || e.enrollYear || '',
          enrollMonth: e.gradSchoolEnrollMonth || e.enrollMonth || '',
          gradYear: e.gradSchoolGradYear || e.gradYear || '',
          gradMonth: e.gradSchoolGradMonth || e.gradMonth || '',
        }
      : { ...prior };

    return { isGradSchool: grad, final, prior };
  }

  function applyToFlat(flat, education) {
    const { final, prior } = resolve(education);
    return {
      ...flat,
      enrollYear: final.enrollYear,
      enrollMonth: final.enrollMonth,
      gradYear: final.gradYear,
      gradMonth: final.gradMonth,
      priorEnrollYear: prior.enrollYear,
      priorEnrollMonth: prior.enrollMonth,
      priorGradYear: prior.gradYear,
      priorGradMonth: prior.gradMonth,
    };
  }

  return { isGradSchool, resolve, applyToFlat };
})();

const root = typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis;
if (root) {
  root.EducationDates = EducationDates;
}
