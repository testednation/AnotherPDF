import { XFAField, XFAAssist } from '../types/pdf';

export interface FieldTooltipGuide {
  title: string;
  guidance: string;
  rawToolTip?: string;
  speakPrompt?: string;
  hasExplicitAssist: boolean;
  formatHint?: string;
  isRequired: boolean;
  source: 'xfa_assist_tooltip' | 'xfa_speak' | 'template_desc' | 'semantic_heuristic';
  bindingPath: string;
}

/**
 * Extracts text from an element whether directly in text content,
 * or wrapped in child `<text>` or `<value>` elements.
 */
function extractNodeText(elem?: Element | null): string {
  if (!elem) return '';
  const textChild = elem.getElementsByTagName('text')[0];
  if (textChild && textChild.textContent) {
    return textChild.textContent.trim();
  }
  const valChild = elem.getElementsByTagName('value')[0];
  if (valChild && valChild.textContent) {
    return valChild.textContent.trim();
  }
  return elem.textContent?.trim() || '';
}

/**
 * Parses XFA `<assist>`, `<toolTip>`, and `<speak>` properties from a field DOM Element.
 * Standard Adobe XFA Specifications (3.3 & earlier):
 * - `<field><assist><toolTip>Help text</toolTip><speak>Audio text</speak></assist></field>`
 * - `<field><assist toolTip="Help text" /></field>`
 * - `<field><toolTip>Direct toolTip text</toolTip></field>`
 * - `<field toolTip="Attribute toolTip text" />`
 */
export function parseXfaAssistFromElement(fieldElem: Element): {
  assist?: XFAAssist;
  tooltip: string;
} {
  let toolTipText = '';
  let speakText = '';
  let descText = '';

  // 1. Check <assist> container
  const assistElem = fieldElem.getElementsByTagName('assist')[0];
  if (assistElem) {
    // Check <toolTip> tag
    const ttElem = assistElem.getElementsByTagName('toolTip')[0] || assistElem.getElementsByTagName('tooltip')[0];
    if (ttElem) {
      toolTipText = extractNodeText(ttElem);
    }
    // Check attribute toolTip on <assist>
    if (!toolTipText) {
      toolTipText = assistElem.getAttribute('toolTip') || assistElem.getAttribute('tooltip') || '';
    }

    // Check <speak> tag
    const spkElem = assistElem.getElementsByTagName('speak')[0];
    if (spkElem) {
      speakText = extractNodeText(spkElem);
    }
    if (!speakText) {
      speakText = assistElem.getAttribute('speak') || '';
    }
  }

  // 2. Check direct <toolTip> or <tooltip> under <field>
  if (!toolTipText) {
    const directTt = Array.from(fieldElem.children).find(
      c => c.localName === 'toolTip' || c.localName === 'tooltip'
    );
    if (directTt) {
      toolTipText = extractNodeText(directTt);
    }
  }

  // 3. Check direct attribute on <field>
  if (!toolTipText) {
    toolTipText = fieldElem.getAttribute('toolTip') || fieldElem.getAttribute('tooltip') || '';
  }

  // 4. Check <desc> tag
  const descElem = fieldElem.getElementsByTagName('desc')[0];
  if (descElem) {
    descText = extractNodeText(descElem);
  }

  // Determine primary tooltip
  const primaryTooltip = toolTipText || descText || speakText || '';

  const assistData: XFAAssist | undefined =
    toolTipText || speakText || descText
      ? {
          toolTip: toolTipText || undefined,
          speak: speakText || undefined,
          desc: descText || undefined,
        }
      : undefined;

  return {
    assist: assistData,
    tooltip: primaryTooltip,
  };
}

/**
 * Derives friendly format hints from picture clauses, types, or semantic rules
 */
export function deriveFormatHint(field: XFAField): string | undefined {
  if (field.validation?.picturePattern) {
    const pic = field.validation.picturePattern;
    if (pic.includes('date{')) return pic.replace('date{', 'Date: ').replace('}', '');
    if (pic.includes('text{')) return pic.replace('text{', 'Format: ').replace('}', '');
    if (pic.includes('num{')) return pic.replace('num{', 'Numeric: ').replace('}', '');
    return pic;
  }

  const name = (field.name + ' ' + (field.caption || '')).toLowerCase();
  if (name.includes('postal')) return 'Canadian Postal Code (e.g., A1A 1A1)';
  if (name.includes('phone') || name.includes('telephone')) return 'Phone (e.g., (555) 555-5555)';
  if (name.includes('business_num') || name.includes('bus_num') || name.includes('cra')) return '9-digit CRA Business Number';
  if (name.includes('fiscal') && name.includes('year')) return 'Fiscal Year (e.g., 2025-2026)';
  if (name.includes('email')) return 'Standard Email (e.g., name@domain.com)';
  if (field.type === 'date') return 'Date (YYYY-MM-DD)';
  if (field.type === 'numeric') return 'Numerical amount (CAD $)';

  return undefined;
}

/**
 * Returns comprehensive guidance metadata for any XFA field,
 * prioritizing official XFA template `<assist>` / `<toolTip>` properties,
 * and falling back gracefully to plain-English guidance and format hints.
 */
export function getFieldTooltipGuide(field: XFAField): FieldTooltipGuide {
  const hasExplicitToolTip = Boolean(field.assist?.toolTip || field.tooltip);
  const hasExplicitSpeak = Boolean(field.assist?.speak);
  const hasExplicitDesc = Boolean(field.assist?.desc);

  let guidance = '';
  let source: FieldTooltipGuide['source'] = 'semantic_heuristic';

  if (field.assist?.toolTip) {
    guidance = field.assist.toolTip;
    source = 'xfa_assist_tooltip';
  } else if (field.tooltip) {
    guidance = field.tooltip;
    source = 'xfa_assist_tooltip';
  } else if (field.assist?.desc) {
    guidance = field.assist.desc;
    source = 'template_desc';
  } else if (field.assist?.speak) {
    guidance = field.assist.speak;
    source = 'xfa_speak';
  } else {
    // Semantic Heuristic Guidance
    guidance = generateSemanticGuidance(field);
    source = 'semantic_heuristic';
  }

  return {
    title: field.caption || field.name,
    guidance,
    rawToolTip: field.assist?.toolTip || field.tooltip,
    speakPrompt: field.assist?.speak,
    hasExplicitAssist: hasExplicitToolTip || hasExplicitSpeak || hasExplicitDesc,
    formatHint: deriveFormatHint(field),
    isRequired: Boolean(field.required),
    source,
    bindingPath: field.dataRef || field.name,
  };
}

/**
 * Generates plain-English guidance when no explicit template assist tag is present.
 */
function generateSemanticGuidance(field: XFAField): string {
  const name = field.name.toLowerCase();
  const caption = (field.caption || '').toLowerCase();

  if (caption.includes('legal name') || name.includes('company') || name.includes('recipient')) {
    return 'Enter the official registered corporate or legal organization name as filed with the registry authority.';
  }
  if (caption.includes('agreement') || name.includes('agreement')) {
    return 'Official funding agreement identifier assigned by the administering government ministry or agency.';
  }
  if (caption.includes('business number') || name.includes('tax') || name.includes('ein')) {
    return 'Enter the 9-digit Business Identification Number without spaces or hyphens.';
  }
  if (caption.includes('fiscal year') || name.includes('fiscal')) {
    return 'Official financial reporting fiscal year in four-digit span format (YYYY-YYYY).';
  }
  if (caption.includes('phone') || name.includes('telephone')) {
    return 'Direct telephone number of the authorized contact person, including standard area code.';
  }
  if (caption.includes('email') || name.includes('email')) {
    return 'Authorized executive contact email address for official legal and compliance notices.';
  }
  if (caption.includes('revenue') || name.includes('rev') || caption.includes('contribution') || caption.includes('grant')) {
    return 'Actual verified revenue or contribution amount in Canadian dollars (CAD $) allocated to this project.';
  }
  if (caption.includes('expenditure') || caption.includes('cost') || name.includes('cost') || name.includes('exp')) {
    return 'Eligible operational expenses incurred during the approved agreement performance window.';
  }
  if (field.type === 'signature' || caption.includes('sign') || name.includes('sign')) {
    return 'Type the full legal name of the signing executive officer to certify and execute this document electronically.';
  }
  if (field.type === 'choice') {
    return 'Select one approved option from the authorized dropdown list.';
  }
  if (field.type === 'check') {
    return 'Select checkbox to confirm attestation and accept regulatory terms.';
  }
  if (field.type === 'date') {
    return 'Calendar date formatted as YYYY-MM-DD.';
  }
  return 'Please fill in this form field accurately as it appears on your verified records.';
}

/**
 * Returns a formatted multi-line plain text tooltip string
 * suitable for HTML `title` attributes or simple tooltip popups.
 */
export function formatTooltipPlainText(field: XFAField): string {
  const guide = getFieldTooltipGuide(field);
  const parts: string[] = [guide.title];

  if (guide.isRequired) {
    parts.push('[Required]');
  }

  parts.push(`\n${guide.guidance}`);

  if (guide.formatHint) {
    parts.push(`\n${guide.formatHint}`);
  }

  if (guide.speakPrompt) {
    parts.push(`\nSpeech prompt: "${guide.speakPrompt}"`);
  }

  return parts.join(' ');
}
