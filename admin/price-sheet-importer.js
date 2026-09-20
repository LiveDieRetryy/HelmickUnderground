(function () {
    const KNOWN_UOMS = [
        'SQUARE FOOT', 'CUBIC YARD', 'LINEAR FOOT', 'FOOT', 'EACH', 'HOUR', 'ACTUAL',
        'SQUARE YARD', 'LINEAR YARD', 'MILE', 'DAY', 'POUND', 'LB', 'GALLON', 'TON', 'LOCATION'
    ];
    const COMMON_UOM_VALUES = new Set([
        ...KNOWN_UOMS,
        'EA', 'LF', 'SF', 'SY', 'CY', 'LS', 'LOT', 'JOB', 'SET', 'PAIR'
    ]);

    function normalizeText(value) {
        return String(value || '').trim();
    }

    function isNonRowLine(value) {
        const normalized = normalizeText(value).toUpperCase();
        return !normalized
            || /^ANNEX\s+[A-Z]$/.test(normalized)
            || /^PAGE\s+\d+$/.test(normalized)
            || normalized === 'UNIT'
            || normalized === 'UOM'
            || normalized === 'DESCRIPTION'
            || normalized === 'PRICE'
            || ['SQUARE', 'CUBIC', 'LINEAR'].includes(normalized);
    }

    function isPlausibleRow(item) {
        const code = normalizeText(item && item.code);
        if (!code || code.length > 100 || !/[A-Z]/i.test(code)) return false;
        if (['SQUARE', 'CUBIC', 'LINEAR'].includes(code.toUpperCase())) return false;

        return !/^(ANNEX|PAGE|UNIT|UOM|DESCRIPTION|PRICE|DOCUSIGN)\b/i.test(code)
            && !/\b(ALL LABOR|PASS THROUGH|THIS UNIT|CONSTRUCTION ZONE|REQUIRED TO|DRAFT|ACTUAL COST|PAID UNDER|ACTIVITIES|NOT FOR)\b/i.test(code)
            && !/\b(NAME|TITLE|JERRY|MIKE|LUMEN NEWCO|MATERIAL NEWCO|UGB)\b/i.test(code)
            && !/\b\d{3,5}\s+\w+\s+(STREET|ST|ROAD|RD|AVENUE|AVE|BOX)\b/i.test(code)
            && !/^\s*(BUILDING|INNERDUCT|FACILITIES|FACILITY|REGULATIONS|REQUIRED)\b/i.test(code);
    }

    function findUnitAndUom(beforePrice) {
        const normalized = beforePrice.replace(/\s+/g, ' ').trim();
        for (const uom of KNOWN_UOMS) {
            const index = normalized.lastIndexOf(uom);
            if (index !== -1) {
                const unit = normalized.slice(0, index).trim();
                const remainder = normalized.slice(index + uom.length).trim();
                if (unit && !remainder) {
                    return { unit, uom };
                }
            }
        }

        return null;
    }

    function findStructuredColumns(beforePrice) {
        const normalized = beforePrice.replace(/\s+/g, ' ').trim();
        for (const uom of KNOWN_UOMS) {
            const marker = ` ${uom} `;
            const index = normalized.indexOf(marker);
            if (index === -1) continue;

            const unit = normalized.slice(0, index).trim();
            const description = normalized.slice(index + marker.length).trim();
            const descriptionEndsWithUom = KNOWN_UOMS.some(candidate =>
                description.toUpperCase().endsWith(` ${candidate}`)
            );
            if (unit && description && !descriptionEndsWithUom) return { unit, uom, description };
        }

        return null;
    }

    function findGenericUom(beforePrice) {
        const normalized = beforePrice.replace(/\s+/g, ' ').trim();
        const words = normalized.split(' ');
        const maxSuffixLength = Math.min(3, words.length - 1);

        for (let suffixLength = 1; suffixLength <= maxSuffixLength; suffixLength++) {
            const unit = words.slice(0, -suffixLength).join(' ').trim();
            const uom = words.slice(-suffixLength).join(' ').trim();
            if (!unit || !uom || uom.length > 32) continue;

            const isColumnLikeUom = /^[A-Z0-9]+(?:[ /-][A-Z0-9]+)*$/i.test(uom)
                && /[A-Z]/i.test(uom)
                && !/[<>=]/.test(uom);
            if (isColumnLikeUom) return { unit, uom };
        }

        return null;
    }

    function parsePriceSheetLine(lineText) {
        const text = normalizeText(lineText);
        if (!text) return null;

        const withoutPageLabels = text
            .replace(/^(page|Page)\s*\d+\s*$/i, '')
            .replace(/^annex\s+[a-z]+\s*$/i, '')
            .trim();

        if (!withoutPageLabels) return null;

        const tabParts = withoutPageLabels.split(/\t+/).map(part => normalizeText(part));
        if (tabParts.length === 2) {
            const [code, priceText] = tabParts;
            const priceValue = Number(String(priceText || '').replace(/[$,]/g, '').trim());

            if (code && code.toUpperCase() !== 'UNIT' && priceText && Number.isFinite(priceValue)) {
                return {
                    code,
                    description: code,
                    uom: '',
                    price: parseFloat(priceValue.toFixed(2))
                };
            }
        }

        if (tabParts.length >= 4) {
            const [firstPart, secondPart, ...descriptionParts] = tabParts;
            const normalizedSecondPart = secondPart.toUpperCase();
            const code = COMMON_UOM_VALUES.has(normalizedSecondPart)
                ? firstPart
                : `${firstPart} ${secondPart}`.trim();
            const uom = COMMON_UOM_VALUES.has(normalizedSecondPart) ? secondPart : '';
            const priceText = descriptionParts.pop();
            const description = descriptionParts.join(' ');
            const priceValue = Number(String(priceText || '').replace(/[$,]/g, '').trim());

            if ([code, uom, description, priceText].map(part => String(part || '').toUpperCase()).includes('UNIT')
                || String(uom || '').toUpperCase() === 'UOM') {
                return null;
            }

            if (code && description && Number.isFinite(priceValue)) {
                return {
                    code,
                    description,
                    uom,
                    price: parseFloat(priceValue.toFixed(2))
                };
            }
        }

        let cleaned = withoutPageLabels
            .replace(/\u2013|\u2014/g, '-')
            .replace(/\s*\|\s*/g, ' | ')
            .replace(/\s+/g, ' ')
            .replace(/\s+[X✓]\s*$/i, '')
            .trim();

        if (cleaned.includes('|')) {
            const pipeParts = cleaned.split('|').map(part => normalizeText(part));
            if (pipeParts.length >= 3) {
                const [first, uom, priceText] = pipeParts;
                if (!first || !uom || !priceText) return null;

                const priceValue = Number(String(priceText).replace(/[$,]/g, '').trim());
                if (!Number.isFinite(priceValue)) return null;

                const code = first;
                return {
                    code,
                    description: code,
                    uom,
                    price: parseFloat(priceValue.toFixed(2))
                };
            }
        }

        const moneyMatch = cleaned.match(/\$\d+(?:,\d{3})*(?:\.\d{2})?/)
            || cleaned.match(/\d+(?:,\d{3})*(?:\.\d{2})?(?=\s*$)/);
        if (!moneyMatch) return null;

        const priceValue = Number(String(moneyMatch[0]).replace(/[$,]/g, '').trim());
        if (!Number.isFinite(priceValue)) return null;

        const beforePrice = cleaned.slice(0, cleaned.indexOf(moneyMatch[0])).trim();
        if (!beforePrice) return null;

        const structured = findStructuredColumns(beforePrice);
        if (structured) {
            const normalizedUnit = structured.unit.toUpperCase();
            const normalizedDescription = structured.description.toUpperCase();
            const descriptionContinuesUnit = normalizedDescription.startsWith(`${normalizedUnit} `)
                && structured.description.length - structured.unit.length <= 32;
            const code = descriptionContinuesUnit ? structured.description : structured.unit;

            return {
                code,
                description: structured.description,
                uom: structured.uom,
                price: parseFloat(priceValue.toFixed(2))
            };
        }

        const guessed = findUnitAndUom(beforePrice) || findGenericUom(beforePrice) || {
            unit: beforePrice,
            uom: ''
        };

        if (!guessed.unit || !guessed.uom) return null;

        return {
            code: guessed.unit,
            description: guessed.unit,
            uom: guessed.uom,
            price: parseFloat(priceValue.toFixed(2))
        };
    }

    function parsePriceSheetText(text) {
        if (!text) return [];

        const lines = String(text).split(/\r?\n/);
        const rows = [];
        const seen = new Set();

        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            if (isNonRowLine(line) || !/\$\s*\d/.test(line)) continue;

            if (line.includes('\t') || line.includes('|')) {
                const delimitedItem = parsePriceSheetLine(line);
                if (!delimitedItem || !isPlausibleRow(delimitedItem)) continue;

                const key = `${delimitedItem.code.trim().toUpperCase()}|${delimitedItem.uom.trim().toUpperCase()}|${delimitedItem.price}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    rows.push(delimitedItem);
                }
                continue;
            }

            // Anchor extraction on the price token. PDF descriptions may span
            // many lines, but the unit and UOM are immediately before the price.
            const currentLineItem = parsePriceSheetLine(line);
            if (currentLineItem && isPlausibleRow(currentLineItem)) {
                const key = `${currentLineItem.code.trim().toUpperCase()}|${currentLineItem.uom.trim().toUpperCase()}|${currentLineItem.price}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    rows.push(currentLineItem);
                }
                continue;
            }

            const candidates = [];
            for (let start = Math.max(0, index - 3); start <= index; start++) {
                const candidate = parsePriceSheetLine(lines.slice(start, index + 1).join(' '));
                if (candidate && isPlausibleRow(candidate)) candidates.push(candidate);
            }

            const item = candidates.sort((first, second) => first.code.length - second.code.length)[0];
            if (!item) continue;

            const normalizedItem = {
                ...item,
                description: item.description && item.description.length <= 120
                    ? item.description
                    : item.code
            };
            const key = `${normalizedItem.code.trim().toUpperCase()}|${normalizedItem.uom.trim().toUpperCase()}|${normalizedItem.price}`;
            if (!seen.has(key)) {
                seen.add(key);
                rows.push(normalizedItem);
            }
        }

        return rows;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            parsePriceSheetLine,
            parsePriceSheetText
        };
    }

    window.PriceSheetImporter = {
        parsePriceSheetLine,
        parsePriceSheetText
    };
})();
