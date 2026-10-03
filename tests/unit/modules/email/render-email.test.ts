import { describe, expect, it } from 'vitest';
import { findPlaceholders, renderHtml, renderSubject, validateTemplateVariables } from '@/lib/modules/email/domain/render-email';
import { SYSTEM_TEMPLATE_DEFINITIONS, BROADCAST_TEMPLATE_DEFINITION } from '@/lib/modules/email/domain/email-template-registry';
import { EMAIL_DEFAULTS, SYSTEM_TEMPLATE_SLUGS } from '@/lib/email-defaults';

describe('template rendering', () => {
  it('escapes every value put into HTML, including quotes that could break an attribute', () => {
    expect(renderHtml('<p title="{{firstName}}">{{firstName}}</p>', { firstName: `"><img src=x onerror=alert(1)>'` }))
      .toBe('<p title="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;&#39;">&quot;&gt;&lt;img src=x onerror=alert(1)&gt;&#39;</p>');
  });

  it('never shows a raw placeholder: unknown or empty ones render as nothing', () => {
    expect(renderHtml('<p>{{ firstName }} {{nope}}</p>', { firstName: 'Ala' })).toBe('<p>Ala </p>');
  });

  it('keeps the subject on one line', () => {
    expect(renderSubject('Cześć {{firstName}}', { firstName: 'Ala\r\nBcc: x@y.z' })).toBe('Cześć Ala Bcc: x@y.z');
  });

  it('finds placeholders with or without spaces', () => {
    expect(findPlaceholders('{{a}} {{ b }} {{a}}').sort()).toEqual(['a', 'b']);
  });

  it('flags unknown variables and a missing required link in any language version', () => {
    const verify = SYSTEM_TEMPLATE_DEFINITIONS['verify-email'];
    expect(validateTemplateVariables(verify, { subject: 's', html: '<a href="{{actionUrl}}">x</a>', htmlEn: '<p>{{amount}}</p>' }))
      .toEqual({ unknown: ['amount'], missingRequired: ['actionUrl'] });
    expect(validateTemplateVariables(BROADCAST_TEMPLATE_DEFINITION, { subject: '{{firstName}}', html: '{{unsubscribeLink}}' }))
      .toEqual({ unknown: [], missingRequired: [] });
  });

  it.each(SYSTEM_TEMPLATE_SLUGS)('the code default of %s uses only its own variables', (slug) => {
    const problems = validateTemplateVariables(SYSTEM_TEMPLATE_DEFINITIONS[slug], EMAIL_DEFAULTS[slug]);
    expect(problems).toEqual({ unknown: [], missingRequired: [] });
  });

  it('only the welcome mail offers the unsubscribe link among system mails', () => {
    const withLink = SYSTEM_TEMPLATE_SLUGS.filter((slug) => SYSTEM_TEMPLATE_DEFINITIONS[slug].unsubscribe);
    expect(withLink).toEqual(['welcome-email']);
  });
});
