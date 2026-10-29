import { PDFDocument, PDFName, PDFDict, PDFArray, PDFStream, PDFRawStream } from 'pdf-lib';
import { XFAField, XFASubform, XFAPackets } from '../types/pdf';
import { parseXfaAssistFromElement } from './xfaTooltipHelper';

/**
 * Decodes a Uint8Array or stream bytes to string, handling UTF-8, UTF-16BE/LE
 */
export function decodeStreamToString(bytes: Uint8Array): string {
  // Check for UTF-16 BOM
  if (bytes.length >= 2) {
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder('utf-16be').decode(bytes);
    }
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder('utf-16le').decode(bytes);
    }
  }
  // Try UTF-8
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    // Fallback ascii
    let res = '';
    for (let i = 0; i < bytes.length; i++) {
      res += String.fromCharCode(bytes[i]);
    }
    return res;
  }
}

/**
 * Extracts raw XFA streams and packets from a loaded PDFDocument
 */
export async function extractXfaPackets(pdfDoc: PDFDocument, rawBytes: Uint8Array): Promise<XFAPackets> {
  const packets: XFAPackets = {
    otherPackets: {},
  };

  try {
    const catalog = pdfDoc.catalog;
    const acroFormRef = catalog.get(PDFName.of('AcroForm'));
    if (!acroFormRef) {
      // Fallback: check if raw bytes contain <xdp:xdp or <template
      return extractXfaFromRawBytes(rawBytes);
    }

    const acroForm = pdfDoc.context.lookup(acroFormRef);
    if (!(acroForm instanceof PDFDict)) {
      return extractXfaFromRawBytes(rawBytes);
    }

    const xfaEntry = acroForm.get(PDFName.of('XFA'));
    if (!xfaEntry) {
      return extractXfaFromRawBytes(rawBytes);
    }

    const resolvedXfa = pdfDoc.context.lookup(xfaEntry);

    // Case 1: XFA is a PDFStream / PDFRawStream (contains full XDP or XML)
    if (resolvedXfa instanceof PDFStream || resolvedXfa instanceof PDFRawStream) {
      const streamBytes = resolvedXfa.getContents();
      const content = decodeStreamToString(streamBytes);
      if (content.includes('<xdp:xdp') || content.includes('<template') || content.includes('<xdp:package')) {
        packets.fullXdpXml = content;
        parseXdpIntoPackets(content, packets);
        return packets;
      }
    }

    // Case 2: XFA is an array of [packetNameString, streamRef, packetNameString, streamRef, ...]
    if (resolvedXfa instanceof PDFArray) {
      const arrayLength = resolvedXfa.size();
      for (let i = 0; i < arrayLength; i += 2) {
        const nameObj = resolvedXfa.get(i);
        const nameStr = nameObj ? nameObj.toString().replace(/^\//, '').replace(/^"|"$/g, '').trim() : `packet_${i}`;
        const streamObj = resolvedXfa.get(i + 1);
        if (!streamObj) continue;

        const resolvedStream = pdfDoc.context.lookup(streamObj);
        if (resolvedStream instanceof PDFStream || resolvedStream instanceof PDFRawStream) {
          const streamBytes = resolvedStream.getContents();
          const xmlContent = decodeStreamToString(streamBytes);

          const lowerName = nameStr.toLowerCase();
          if (lowerName === 'template') {
            packets.templateXml = xmlContent;
          } else if (lowerName === 'datasets' || lowerName === 'data') {
            packets.datasetsXml = xmlContent;
          } else if (lowerName === 'config') {
            packets.configXml = xmlContent;
          } else if (lowerName === 'localeset') {
            packets.localeSetXml = xmlContent;
          } else if (lowerName === 'schema') {
            packets.schemaXml = xmlContent;
          } else if (lowerName === 'xdp') {
            packets.fullXdpXml = xmlContent;
            parseXdpIntoPackets(xmlContent, packets);
          } else {
            packets.otherPackets[nameStr] = xmlContent;
          }
        }
      }

      // If fullXdpXml isn't populated yet, construct it
      if (!packets.fullXdpXml && (packets.templateXml || packets.datasetsXml)) {
        packets.fullXdpXml = assembleXdpPackage(packets);
      }

      return packets;
    }
  } catch (err) {
    console.warn('Error reading XFA via PDF-lib structure:', err);
  }

  // Fallback to raw bytes pattern search
  return extractXfaFromRawBytes(rawBytes);
}

/**
 * Fallback regex / byte extractor for XFA packets in PDF stream
 */
function extractXfaFromRawBytes(bytes: Uint8Array): XFAPackets {
  const packets: XFAPackets = { otherPackets: {} };
  const text = decodeStreamToString(bytes);

  const xdpStart = text.indexOf('<xdp:xdp');
  const xdpEnd = text.indexOf('</xdp:xdp>');
  if (xdpStart !== -1 && xdpEnd !== -1) {
    const fullXdp = text.substring(xdpStart, xdpEnd + 10);
    packets.fullXdpXml = fullXdp;
    parseXdpIntoPackets(fullXdp, packets);
    return packets;
  }

  // Extract individual tags if present
  const extractTag = (tagName: string) => {
    const open = `<${tagName}`;
    const close = `</${tagName}>`;
    const s = text.indexOf(open);
    if (s === -1) return undefined;
    const e = text.indexOf(close, s);
    if (e === -1) return undefined;
    return text.substring(s, e + close.length);
  };

  packets.templateXml = extractTag('template');
  packets.datasetsXml = extractTag('xfa:datasets') || extractTag('datasets') || extractTag('xfa:data') || extractTag('data');
  packets.configXml = extractTag('config');
  packets.localeSetXml = extractTag('localeSet');

  if (packets.templateXml || packets.datasetsXml) {
    packets.fullXdpXml = assembleXdpPackage(packets);
  }

  return packets;
}

/**
 * Splits a full XDP XML package into individual component packets
 */
function parseXdpIntoPackets(xdpContent: string, packets: XFAPackets) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xdpContent, 'application/xml');

    const templateElem = doc.getElementsByTagName('template')[0];
    if (templateElem && !packets.templateXml) {
      packets.templateXml = new XMLSerializer().serializeToString(templateElem);
    }

    const datasetsElem = doc.getElementsByTagName('xfa:datasets')[0] || doc.getElementsByTagName('datasets')[0];
    if (datasetsElem && !packets.datasetsXml) {
      packets.datasetsXml = new XMLSerializer().serializeToString(datasetsElem);
    } else {
      const dataElem = doc.getElementsByTagName('xfa:data')[0] || doc.getElementsByTagName('data')[0];
      if (dataElem && !packets.datasetsXml) {
        packets.datasetsXml = new XMLSerializer().serializeToString(dataElem);
      }
    }

    const configElem = doc.getElementsByTagName('config')[0];
    if (configElem && !packets.configXml) {
      packets.configXml = new XMLSerializer().serializeToString(configElem);
    }

    const localeSetElem = doc.getElementsByTagName('localeSet')[0];
    if (localeSetElem && !packets.localeSetXml) {
      packets.localeSetXml = new XMLSerializer().serializeToString(localeSetElem);
    }
  } catch (err) {
    console.warn('Failed to parse XDP XML into individual packets:', err);
  }
}

/**
 * Assembles an XDP XML envelope from separate component packets
 */
export function assembleXdpPackage(packets: XFAPackets): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<xdp:xdp xmlns:xdp="http://ns.adobe.com/xdp/">\n`;
  if (packets.configXml) xml += `  ${packets.configXml}\n`;
  if (packets.templateXml) xml += `  ${packets.templateXml}\n`;
  if (packets.datasetsXml) xml += `  ${packets.datasetsXml}\n`;
  if (packets.localeSetXml) xml += `  ${packets.localeSetXml}\n`;
  for (const [name, content] of Object.entries(packets.otherPackets)) {
    xml += `  <${name}>${content}</${name}>\n`;
  }
  xml += `</xdp:xdp>`;
  return xml;
}

/**
 * Extracts a map of data values from `<datasets>` XML (e.g., path/tag -> text)
 */
export function extractDataValues(datasetsXml?: string): Map<string, string> {
  const values = new Map<string, string>();
  if (!datasetsXml) return values;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(datasetsXml, 'application/xml');

    const walkNode = (node: Element, currentPath: string) => {
      const nodeName = node.localName || node.nodeName;
      const fullPath = currentPath ? `${currentPath}.${nodeName}` : nodeName;

      // Check if node has only text content
      const childElements = Array.from(node.children);
      if (childElements.length === 0) {
        const textVal = node.textContent?.trim() || '';
        values.set(fullPath, textVal);
        values.set(nodeName, textVal); // also set short name for loose binding
      } else {
        childElements.forEach(child => walkNode(child, fullPath));
      }
    };

    const dataRoot = doc.getElementsByTagName('xfa:data')[0] || doc.getElementsByTagName('data')[0] || doc.documentElement;
    if (dataRoot) {
      Array.from(dataRoot.children).forEach(child => walkNode(child, ''));
    }
  } catch (err) {
    console.warn('Error parsing datasets XML for values:', err);
  }

  return values;
}

/**
 * Parses the XFA `<template>` XML into structured interactive Subforms & Fields
 */
export function parseXfaTemplate(templateXml?: string, datasetsXml?: string): XFASubform[] {
  if (!templateXml) return [];

  const dataValues = extractDataValues(datasetsXml);
  const subforms: XFASubform[] = [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(templateXml, 'application/xml');

    // Find root subform(s)
    const rootSubforms = Array.from(doc.querySelectorAll('template > subform, subform'));
    const topLevelSubforms = rootSubforms.filter(sf => sf.parentElement?.tagName.toLowerCase() === 'template' || sf === rootSubforms[0]);

    if (topLevelSubforms.length === 0) {
      // Create a fallback subform containing all fields in doc
      const allFields = parseFieldsFromElement(doc.documentElement, dataValues, 'root');
      if (allFields.length > 0) {
        return [{
          id: 'root-subform',
          name: 'General Form Fields',
          title: 'Form Fields',
          fields: allFields,
          subforms: [],
        }];
      }
      return [];
    }

    topLevelSubforms.forEach((sfElem, idx) => {
      const subform = parseSubformElement(sfElem, dataValues, `sf-${idx}`);
      if (subform.fields.length > 0 || subform.subforms.length > 0) {
        subforms.push(subform);
      }
    });

  } catch (err) {
    console.error('Failed to parse XFA template XML:', err);
  }

  return subforms;
}

function parseSubformElement(elem: Element, dataValues: Map<string, string>, prefix: string): XFASubform {
  const name = elem.getAttribute('name') || `Section ${prefix}`;
  const title = formatHumanTitle(name);

  // Parse immediate fields belonging to this subform
  const fields = parseFieldsFromElement(elem, dataValues, name, false);

  // Parse child subforms
  const childSubforms: XFASubform[] = [];
  const childSfNodes = Array.from(elem.children).filter(c => c.localName === 'subform');
  childSfNodes.forEach((childNode, i) => {
    const childSf = parseSubformElement(childNode, dataValues, `${prefix}-${i}`);
    if (childSf.fields.length > 0 || childSf.subforms.length > 0) {
      childSubforms.push(childSf);
    }
  });

  return {
    id: prefix,
    name,
    title,
    fields,
    subforms: childSubforms,
  };
}

/**
 * Converts standard XFA measurement units (mm, cm, in, pt, px) to PDF point coordinates (72 points = 1 inch)
 */
export function parseUnitToPoints(valStr: string | null | undefined, defaultPoints: number): number {
  if (!valStr || typeof valStr !== 'string') return defaultPoints;
  const trimmed = valStr.trim().toLowerCase();
  if (!trimmed) return defaultPoints;

  if (trimmed.endsWith('mm')) {
    const val = parseFloat(trimmed);
    return isNaN(val) ? defaultPoints : val * 2.83464567; // 72 / 25.4
  }
  if (trimmed.endsWith('cm')) {
    const val = parseFloat(trimmed);
    return isNaN(val) ? defaultPoints : val * 28.3464567;
  }
  if (trimmed.endsWith('in')) {
    const val = parseFloat(trimmed);
    return isNaN(val) ? defaultPoints : val * 72;
  }
  if (trimmed.endsWith('pt')) {
    const val = parseFloat(trimmed);
    return isNaN(val) ? defaultPoints : val;
  }
  if (trimmed.endsWith('px')) {
    const val = parseFloat(trimmed);
    return isNaN(val) ? defaultPoints : val * 0.75;
  }

  const num = parseFloat(trimmed);
  return isNaN(num) ? defaultPoints : num;
}

export function getDefaultAppearanceForType(type: XFAField['type']): NonNullable<XFAField['appearance']> {
  switch (type) {
    case 'check':
      return {
        borderColor: '#10b981',
        borderWidth: 1.5,
        borderStyle: 'solid',
        backgroundColor: '#ecfdf5',
        textColor: '#064e3b',
        fontSize: 10,
        fontFamily: 'Helvetica',
        fontWeight: 'normal',
        captionPlacement: 'left',
        cornerRadius: 3,
      };
    case 'choice':
      return {
        borderColor: '#8b5cf6',
        borderWidth: 1,
        borderStyle: 'solid',
        backgroundColor: '#f5f3ff',
        textColor: '#4c1d95',
        fontSize: 10,
        fontFamily: 'Helvetica',
        fontWeight: 'normal',
        captionPlacement: 'top',
        cornerRadius: 4,
      };
    case 'numeric':
    case 'date':
      return {
        borderColor: '#f59e0b',
        borderWidth: 1,
        borderStyle: 'solid',
        backgroundColor: '#fffbeb',
        textColor: '#78350f',
        fontSize: 10,
        fontFamily: 'Helvetica',
        fontWeight: 'normal',
        captionPlacement: 'top',
        cornerRadius: 4,
      };
    case 'signature':
      return {
        borderColor: '#f43f5e',
        borderWidth: 1.5,
        borderStyle: 'dashed',
        backgroundColor: '#fff1f2',
        textColor: '#881337',
        fontSize: 11,
        fontFamily: 'Times-Roman',
        fontWeight: 'bold',
        captionPlacement: 'top',
        cornerRadius: 6,
      };
    case 'multiline':
      return {
        borderColor: '#0ea5e9',
        borderWidth: 1,
        borderStyle: 'solid',
        backgroundColor: '#f0f9ff',
        textColor: '#0c4a6e',
        fontSize: 10,
        fontFamily: 'Helvetica',
        fontWeight: 'normal',
        captionPlacement: 'top',
        cornerRadius: 4,
      };
    case 'text':
    default:
      return {
        borderColor: '#0284c7',
        borderWidth: 1,
        borderStyle: 'solid',
        backgroundColor: '#f0f9ff',
        textColor: '#0c4a6e',
        fontSize: 10,
        fontFamily: 'Helvetica',
        fontWeight: 'normal',
        captionPlacement: 'top',
        cornerRadius: 4,
      };
  }
}

function parseFieldsFromElement(
  container: Element,
  dataValues: Map<string, string>,
  subformName: string,
  deepSearch = true
): XFAField[] {
  const fields: XFAField[] = [];
  const fieldElements = deepSearch
    ? Array.from(container.getElementsByTagName('field'))
    : Array.from(container.children).filter(c => c.localName === 'field');

  // Determine subform base position and target page
  let subformPage = 1;
  let subformBaseY = 160;

  const lowerSfName = subformName.toLowerCase();
  if (lowerSfName.includes('organization') || lowerSfName.includes('profile')) {
    subformPage = 1;
    subformBaseY = 180;
  } else if (lowerSfName.includes('contact')) {
    subformPage = 1;
    subformBaseY = 360;
  } else if (lowerSfName.includes('financial') || lowerSfName.includes('compliance') || lowerSfName.includes('page2') || lowerSfName.includes('schedule')) {
    subformPage = 2;
    subformBaseY = 140;
  }

  fieldElements.forEach((fElem, idx) => {
    const name = fElem.getAttribute('name') || `field_${idx}`;
    const id = `${subformName}_${name}_${idx}`;

    // Extract caption
    let caption = '';
    const captionElem = fElem.getElementsByTagName('caption')[0];
    if (captionElem) {
      const textElem = captionElem.getElementsByTagName('text')[0];
      caption = textElem?.textContent?.trim() || captionElem.textContent?.trim() || '';
    }
    if (!caption) {
      caption = formatHumanTitle(name);
    }

    // Extract binding / dataRef
    const bindElem = fElem.getElementsByTagName('bind')[0];
    const dataRef = bindElem?.getAttribute('ref') || name;

    // Determine UI field type
    let type: XFAField['type'] = 'text';
    const uiElem = fElem.getElementsByTagName('ui')[0];
    const options: string[] = [];

    if (uiElem) {
      const firstChild = uiElem.children[0];
      const uiTag = firstChild ? firstChild.localName : '';

      if (uiTag === 'checkbutton' || uiTag === 'checkButton') {
        type = 'check';
      } else if (uiTag === 'choicelist' || uiTag === 'choiceList') {
        type = 'choice';
        // Extract options from <items>
        const itemElems = fElem.getElementsByTagName('items');
        Array.from(itemElems).forEach(itemsGroup => {
          Array.from(itemsGroup.children).forEach(item => {
            const val = item.textContent?.trim();
            if (val && !options.includes(val)) options.push(val);
          });
        });
      } else if (uiTag === 'numericedit' || uiTag === 'numericEdit') {
        type = 'numeric';
      } else if (uiTag === 'datetimeedit' || uiTag === 'dateTimeEdit') {
        type = 'date';
      } else if (uiTag === 'signature') {
        type = 'signature';
      } else if (uiTag === 'textedit' || uiTag === 'textEdit') {
        const isMultiLine = firstChild?.getAttribute('multiLine') === '1' || fElem.getAttribute('multiLine') === '1';
        type = isMultiLine ? 'multiline' : 'text';
      }
    } else {
      // Heuristics based on name or format
      const lowerName = name.toLowerCase();
      if (lowerName.includes('date')) type = 'date';
      else if (lowerName.includes('sign') || lowerName.includes('signature')) type = 'signature';
      else if (lowerName.includes('check') || lowerName.startsWith('is') || lowerName.startsWith('has')) type = 'check';
    }

    // Determine current value: check dataRef, exact path, or field name
    let value = '';
    if (dataValues.has(dataRef)) {
      value = dataValues.get(dataRef)!;
    } else if (dataValues.has(name)) {
      value = dataValues.get(name)!;
    } else {
      // Check default value in template <value><text>...</text></value>
      const defaultValElem = fElem.getElementsByTagName('value')[0];
      if (defaultValElem) {
        value = defaultValElem.textContent?.trim() || '';
      }
    }

    // Parse comprehensive XFA <assist>, <toolTip>, and <speak> properties
    const { assist: assistData, tooltip } = parseXfaAssistFromElement(fElem);

    // Required & Validation check
    const validateElem = fElem.getElementsByTagName('validate')[0];
    const nullTestAttr = validateElem?.getAttribute('nullTest');
    const isRequired = nullTestAttr === 'error' || fElem.getAttribute('mandatory') === 'error';

    // Parse message, picture clause, script
    let valMessage: string | undefined = undefined;
    let picturePattern: string | undefined = undefined;
    let scriptExpr: string | undefined = undefined;

    if (validateElem) {
      const msgElem = validateElem.getElementsByTagName('message')[0];
      if (msgElem) {
        valMessage = msgElem.getElementsByTagName('text')[0]?.textContent?.trim() || msgElem.textContent?.trim() || undefined;
      }
      const picElem = validateElem.getElementsByTagName('picture')[0];
      if (picElem) {
        picturePattern = picElem.textContent?.trim() || undefined;
      }
      const scriptElem = validateElem.getElementsByTagName('script')[0];
      if (scriptElem) {
        scriptExpr = scriptElem.textContent?.trim() || undefined;
      }
    }

    // Also check <format><picture>
    if (!picturePattern) {
      const formatElem = fElem.getElementsByTagName('format')[0];
      if (formatElem) {
        const pic = formatElem.getElementsByTagName('picture')[0];
        if (pic) picturePattern = pic.textContent?.trim() || undefined;
      }
    }

    const validationRule: import('../types/pdf').XFAValidationRule | undefined = (validateElem || picturePattern || isRequired) ? {
      nullTest: nullTestAttr === 'error' ? 'error' : (nullTestAttr === 'warning' ? 'warning' : (isRequired ? 'error' : undefined)),
      message: valMessage,
      picturePattern,
      scriptExpr,
    } : undefined;

    // Parse geometry bounds
    const rawX = fElem.getAttribute('x') || undefined;
    const rawY = fElem.getAttribute('y') || undefined;
    const rawW = fElem.getAttribute('w') || fElem.getAttribute('width') || undefined;
    const rawH = fElem.getAttribute('h') || fElem.getAttribute('height') || undefined;

    let computedX = 50;
    let computedY = subformBaseY + idx * 42;
    let computedW = 512;
    let computedH = type === 'multiline' ? 52 : (type === 'signature' ? 40 : 28);

    if (rawX || rawY || rawW || rawH) {
      const parsedX = parseUnitToPoints(rawX, 0);
      const parsedY = parseUnitToPoints(rawY, 0);
      computedX = 50 + parsedX;
      computedY = subformBaseY + parsedY;
      computedW = parseUnitToPoints(rawW, 200);
      computedH = parseUnitToPoints(rawH, type === 'multiline' ? 52 : 28);
    }

    const bounds = {
      pageNumber: subformPage,
      x: computedX,
      y: computedY,
      width: computedW,
      height: computedH,
      rawX,
      rawY,
      rawW,
      rawH,
    };

    // Parse appearance properties from template XML if present, otherwise default
    const defaultApp = getDefaultAppearanceForType(type);
    const borderElem = fElem.getElementsByTagName('border')[0];
    const fontElem = fElem.getElementsByTagName('font')[0];

    const appearance = {
      ...defaultApp,
      captionPlacement: (captionElem?.getAttribute('placement') as any) || defaultApp.captionPlacement,
      borderStyle: (borderElem?.getElementsByTagName('edge')[0]?.getAttribute('stroke') as any) || defaultApp.borderStyle,
      fontFamily: fontElem?.getAttribute('typeface') || defaultApp.fontFamily,
      fontWeight: (fontElem?.getAttribute('weight') as any) || defaultApp.fontWeight,
    };

    fields.push({
      id,
      name,
      caption,
      type,
      value,
      defaultValue: value,
      dataRef,
      parentSubform: subformName,
      options: options.length > 0 ? options : undefined,
      required: isRequired,
      readOnly: fElem.getAttribute('access') === 'readOnly',
      visibility: (fElem.getAttribute('presence') as 'visible' | 'invisible' | 'hidden') || 'visible',
      tooltip: tooltip || undefined,
      assist: assistData,
      rawXmlSnippet: new XMLSerializer().serializeToString(fElem),
      bounds,
      appearance,
      validation: validationRule,
    });
  });

  return fields;
}

function formatHumanTitle(str: string): string {
  // Convert camelCase or snake_case to Title Case
  return str
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

/**
 * Updates appearance styling (border, background, font, caption) for a field in the XFA template XML
 */
export function updateFieldAppearanceInTemplate(
  templateXml: string | undefined,
  fieldName: string,
  appearance: NonNullable<XFAField['appearance']>
): string {
  if (!templateXml) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(templateXml, 'application/xml');
    const fields = Array.from(doc.getElementsByTagName('field'));
    const targetField = fields.find(f => f.getAttribute('name') === fieldName);
    if (!targetField) return templateXml;

    // 1. Update <border>
    let borderElem = targetField.getElementsByTagName('border')[0];
    if (!borderElem) {
      borderElem = doc.createElement('border');
      targetField.appendChild(borderElem);
    }

    let edgeElem = borderElem.getElementsByTagName('edge')[0];
    if (!edgeElem) {
      edgeElem = doc.createElement('edge');
      borderElem.appendChild(edgeElem);
    }
    edgeElem.setAttribute('stroke', appearance.borderStyle);
    edgeElem.setAttribute('thickness', `${appearance.borderWidth}pt`);

    let edgeColor = edgeElem.getElementsByTagName('color')[0];
    if (!edgeColor) {
      edgeColor = doc.createElement('color');
      edgeElem.appendChild(edgeColor);
    }
    edgeColor.setAttribute('value', hexToRgbString(appearance.borderColor));

    let fillElem = borderElem.getElementsByTagName('fill')[0];
    if (!fillElem) {
      fillElem = doc.createElement('fill');
      borderElem.appendChild(fillElem);
    }
    let fillColor = fillElem.getElementsByTagName('color')[0];
    if (!fillColor) {
      fillColor = doc.createElement('color');
      fillElem.appendChild(fillColor);
    }
    fillColor.setAttribute('value', hexToRgbString(appearance.backgroundColor));

    // 2. Update <font>
    let fontElem = targetField.getElementsByTagName('font')[0];
    if (!fontElem) {
      fontElem = doc.createElement('font');
      targetField.appendChild(fontElem);
    }
    fontElem.setAttribute('size', `${appearance.fontSize}pt`);
    fontElem.setAttribute('typeface', appearance.fontFamily);
    fontElem.setAttribute('weight', appearance.fontWeight);

    let fontColor = fontElem.getElementsByTagName('color')[0];
    if (!fontColor) {
      fontColor = doc.createElement('color');
      fontElem.appendChild(fontColor);
    }
    fontColor.setAttribute('value', hexToRgbString(appearance.textColor));

    // 3. Update <caption placement="...">
    const captionElem = targetField.getElementsByTagName('caption')[0];
    if (captionElem) {
      captionElem.setAttribute('placement', appearance.captionPlacement);
    }

    return new XMLSerializer().serializeToString(doc);
  } catch (err) {
    console.warn('Failed to update field appearance in template XML:', err);
    return templateXml;
  }
}

export function hexToRgbString(hex: string): string {
  if (!hex || hex === 'transparent') return '255,255,255';
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return '0,0,0';
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r},${g},${b}`;
}

/**
 * Updates the XML `<datasets>` stream with updated field values
 */
export function updateDatasetsXml(originalDatasetsXml: string | undefined, fields: XFAField[]): string {
  const parser = new DOMParser();
  let doc: Document;

  if (originalDatasetsXml && originalDatasetsXml.trim().length > 0) {
    try {
      doc = parser.parseFromString(originalDatasetsXml, 'application/xml');
    } catch {
      doc = parser.parseFromString(
        `<?xml version="1.0" encoding="UTF-8"?>\n<xfa:datasets xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/">\n  <xfa:data>\n  </xfa:data>\n</xfa:datasets>`,
        'application/xml'
      );
    }
  } else {
    doc = parser.parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?>\n<xfa:datasets xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/">\n  <xfa:data>\n  </xfa:data>\n</xfa:datasets>`,
      'application/xml'
    );
  }

  // Find or create <xfa:data>
  let dataNode = doc.getElementsByTagName('xfa:data')[0] || doc.getElementsByTagName('data')[0];
  if (!dataNode) {
    let root = doc.documentElement;
    if (!root) {
      root = doc.createElement('xfa:datasets');
      doc.appendChild(root);
    }
    dataNode = doc.createElement('xfa:data');
    root.appendChild(dataNode);
  }

  // For each field, find or create the XML node and set text content
  fields.forEach(f => {
    const targetTag = cleanXmlTagName(f.name);
    // Find if already exists
    let matchingNode = dataNode.getElementsByTagName(targetTag)[0];
    if (!matchingNode) {
      // Try searching by child directly
      for (let i = 0; i < dataNode.children.length; i++) {
        if (dataNode.children[i].localName === targetTag) {
          matchingNode = dataNode.children[i];
          break;
        }
      }
    }

    if (!matchingNode) {
      matchingNode = doc.createElement(targetTag);
      dataNode.appendChild(matchingNode);
    }

    matchingNode.textContent = f.value;
  });

  return new XMLSerializer().serializeToString(doc);
}

function cleanXmlTagName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Re-saves the PDF with the updated datasets XML embedded into the /AcroForm /XFA stream!
 */
export async function saveUpdatedXfaPdf(
  originalPdfBytes: Uint8Array,
  updatedDatasetsXml: string,
  updatedFullXdp?: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
  const catalog = pdfDoc.catalog;
  const acroFormRef = catalog.get(PDFName.of('AcroForm'));

  const xmlEncoder = new TextEncoder();
  const datasetsBytes = xmlEncoder.encode(updatedDatasetsXml);

  if (acroFormRef) {
    const acroForm = pdfDoc.context.lookup(acroFormRef);
    if (acroForm instanceof PDFDict) {
      const xfaEntry = acroForm.get(PDFName.of('XFA'));
      if (xfaEntry) {
        const resolvedXfa = pdfDoc.context.lookup(xfaEntry);

        // Case 1: XFA is an array of [packetName, streamRef, ...]
        if (resolvedXfa instanceof PDFArray) {
          let foundDatasets = false;
          for (let i = 0; i < resolvedXfa.size(); i += 2) {
            const nameObj = resolvedXfa.get(i);
            const nameStr = nameObj ? nameObj.toString().replace(/^\//, '').replace(/^"|"$/g, '').trim().toLowerCase() : '';
            if (nameStr === 'datasets' || nameStr === 'data') {
              const streamRef = resolvedXfa.get(i + 1);
              if (streamRef) {
                // Create a replacement stream in context
                const newStream = pdfDoc.context.stream(datasetsBytes);
                pdfDoc.context.assign(streamRef as any, newStream);
                foundDatasets = true;
                break;
              }
            }
          }

          if (!foundDatasets) {
            // Append datasets to array
            const newStreamRef = pdfDoc.context.register(pdfDoc.context.stream(datasetsBytes));
            resolvedXfa.push(PDFName.of('datasets'));
            resolvedXfa.push(newStreamRef);
          }
        } else if (resolvedXfa instanceof PDFStream || resolvedXfa instanceof PDFRawStream) {
          // Monolithic XDP package stream
          const xdpBytes = updatedFullXdp
            ? xmlEncoder.encode(updatedFullXdp)
            : datasetsBytes;
          const newStreamRef = pdfDoc.context.register(pdfDoc.context.stream(xdpBytes));
          acroForm.set(PDFName.of('XFA'), newStreamRef);
        }
      } else {
        // AcroForm has no XFA, add it
        const newStreamRef = pdfDoc.context.register(pdfDoc.context.stream(datasetsBytes));
        const xfaArray = pdfDoc.context.obj([PDFName.of('datasets'), newStreamRef]);
        acroForm.set(PDFName.of('XFA'), xfaArray);
      }
    }
  }

  return await pdfDoc.save();
}

/**
 * Creates XML / JSON download blobs
 */
export function exportDataAsFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface BulkTemplateFieldUpdate {
  fieldName: string;
  readOnly?: boolean;
  visibility?: 'visible' | 'invisible' | 'hidden';
  required?: boolean;
}

/**
 * Updates properties (readOnly, visibility, required) for multiple fields in the XFA template XML
 */
export function updateBulkFieldsInTemplate(
  templateXml: string | undefined,
  updates: BulkTemplateFieldUpdate[]
): string {
  if (!templateXml || updates.length === 0) return templateXml || '';

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(templateXml, 'application/xml');
    const fields = Array.from(doc.getElementsByTagName('field'));
    const fieldMap = new Map<string, Element>();
    fields.forEach(f => {
      const name = f.getAttribute('name');
      if (name) fieldMap.set(name, f);
    });

    updates.forEach(up => {
      const target = fieldMap.get(up.fieldName);
      if (!target) return;

      if (up.readOnly !== undefined) {
        if (up.readOnly) {
          target.setAttribute('access', 'readOnly');
        } else {
          target.setAttribute('access', 'open');
        }
      }

      if (up.visibility !== undefined) {
        target.setAttribute('presence', up.visibility);
      }

      if (up.required !== undefined) {
        let validateElem = target.getElementsByTagName('validate')[0];
        if (up.required) {
          if (!validateElem) {
            validateElem = doc.createElement('validate');
            target.appendChild(validateElem);
          }
          validateElem.setAttribute('nullTest', 'error');
        } else {
          if (validateElem) {
            validateElem.setAttribute('nullTest', 'disabled');
          }
        }
      }
    });

    return new XMLSerializer().serializeToString(doc);
  } catch (err) {
    console.warn('Failed to update bulk fields in template XML:', err);
    return templateXml;
  }
}
