const { parsePriceSheetText, parsePriceSheetLine } = require('../admin/price-sheet-importer');

describe('Price sheet importer', () => {
    test('parses a simple pipe-delimited contract row', () => {
        expect(parsePriceSheetLine('BORE 3-4in CABLE-HDPE | FOOT | $10.50')).toEqual({
            code: 'BORE 3-4in CABLE-HDPE',
            description: 'BORE 3-4in CABLE-HDPE',
            uom: 'FOOT',
            price: 10.5
        });
    });

    test('parses a full text block with multiple rows', () => {
        const rows = parsePriceSheetText(`ASPHALT RMV & RESTORE <= 6in | SQUARE FOOT | $22.08
BORE 3-4in CABLE-HDPE | FOOT | $10.50
GROUND ROD 5/8in-8ft | EACH | $20.00`);

        expect(rows).toEqual([
            {
                code: 'ASPHALT RMV & RESTORE <= 6in',
                description: 'ASPHALT RMV & RESTORE <= 6in',
                uom: 'SQUARE FOOT',
                price: 22.08
            },
            {
                code: 'BORE 3-4in CABLE-HDPE',
                description: 'BORE 3-4in CABLE-HDPE',
                uom: 'FOOT',
                price: 10.5
            },
            {
                code: 'GROUND ROD 5/8in-8ft',
                description: 'GROUND ROD 5/8in-8ft',
                uom: 'EACH',
                price: 20
            }
        ]);
    });

    test('parses PDF-like extracted rows with noisy page formatting', () => {
        const rows = parsePriceSheetText(`Annex A
ASPHALT RMV & RESTORE <= 6in  SQUARE FOOT  $22.08
BORE 3-4in CABLE-HDPE FOOT $10.50
Page 12
GROUND ROD 5/8in-8ft EACH $20.00`);

        expect(rows).toEqual([
            {
                code: 'ASPHALT RMV & RESTORE <= 6in',
                description: 'ASPHALT RMV & RESTORE <= 6in',
                uom: 'SQUARE FOOT',
                price: 22.08
            },
            {
                code: 'BORE 3-4in CABLE-HDPE',
                description: 'BORE 3-4in CABLE-HDPE',
                uom: 'FOOT',
                price: 10.5
            },
            {
                code: 'GROUND ROD 5/8in-8ft',
                description: 'GROUND ROD 5/8in-8ft',
                uom: 'EACH',
                price: 20
            }
        ]);
    });

    test('parses tab-delimited Unit, UOM, Description, and Price rows', () => {
        const rows = parsePriceSheetText(`Unit\tUOM\tDescription\tPrice
AC ELECTRICAL SERVICES - OSP\tACTUAL\tAC ELECTRICAL SERVICES - OSP\t$1.00
BORE 3-4in METAL\tFOOT\tBORE 3-4in METAL\t$15.00`);

        expect(rows).toEqual([
            {
                code: 'AC ELECTRICAL SERVICES - OSP',
                description: 'AC ELECTRICAL SERVICES - OSP',
                uom: 'ACTUAL',
                price: 1
            },
            {
                code: 'BORE 3-4in METAL',
                description: 'BORE 3-4in METAL',
                uom: 'FOOT',
                price: 15
            }
        ]);
    });

    test('parses space-separated PDF rows with duplicated descriptions', () => {
        expect(parsePriceSheetLine('AC ELECTRICAL SERVICES - OSP ACTUAL AC ELECTRICAL SERVICES - OSP $1.00')).toEqual({
            code: 'AC ELECTRICAL SERVICES - OSP',
            description: 'AC ELECTRICAL SERVICES - OSP',
            uom: 'ACTUAL',
            price: 1
        });
    });

    test('keeps code suffixes found in the duplicated description column', () => {
        expect(parsePriceSheetLine('ASPHALT RMV & RESTORE <= SQUARE FOOT ASPHALT RMV & RESTORE <= 6in $22.08')).toEqual({
            code: 'ASPHALT RMV & RESTORE <= 6in',
            description: 'ASPHALT RMV & RESTORE <= 6in',
            uom: 'SQUARE FOOT',
            price: 22.08
        });
    });

    test('parses PDF rows split across unit, UOM, price, and marker lines', () => {
        const rows = parsePriceSheetText(`ASPHALT RMV & RESTORE <= 6in
SQUARE
FOOT
$22.08 X
BORE 3-4in CABLE-HDPE FOOT $10.50`);

        expect(rows).toEqual([
            {
                code: 'ASPHALT RMV & RESTORE <= 6in',
                description: 'ASPHALT RMV & RESTORE <= 6in',
                uom: 'SQUARE FOOT',
                price: 22.08
            },
            {
                code: 'BORE 3-4in CABLE-HDPE',
                description: 'BORE 3-4in CABLE-HDPE',
                uom: 'FOOT',
                price: 10.5
            }
        ]);
    });

    test('does not treat a UOM phrase inside the unit code as the row UOM', () => {
        expect(parsePriceSheetLine('FROZEN GROUND LINEAR FOOT ADDER FOOT $7.00')).toEqual({
            code: 'FROZEN GROUND LINEAR FOOT ADDER',
            description: 'FROZEN GROUND LINEAR FOOT ADDER',
            uom: 'FOOT',
            price: 7
        });
    });

    test('parses an unfamiliar UOM without a hard-coded UOM list entry', () => {
        expect(parsePriceSheetLine('MATERIAL DELIVERY LOT $125.00')).toEqual({
            code: 'MATERIAL DELIVERY',
            description: 'MATERIAL DELIVERY',
            uom: 'LOT',
            price: 125
        });
    });

    test('does not create duplicate rows from wrapped descriptions', () => {
        expect(parsePriceSheetText(`All labor and equipment required to perform this work.
BORE 3-4in CABLE-HDPE FOOT $10.50
Additional description text continues here.`)).toEqual([
            {
                code: 'BORE 3-4in CABLE-HDPE',
                description: 'BORE 3-4in CABLE-HDPE',
                uom: 'FOOT',
                price: 10.5
            }
        ]);
    });

    test('ignores signature, address, and description fragments', () => {
        expect(parsePriceSheetText(`Name: Mike P. Brunner $1.00
2218 200TH STREET EAST, PO BOX $189.00
PASS THROUGH COST, INVOICE REQUIRED: AC ELECTRICAL SERVICES - OSP ACTUAL $1.00
AC ELECTRICAL SERVICES - OSP ACTUAL $1.00`)).toEqual([
            {
                code: 'AC ELECTRICAL SERVICES - OSP',
                description: 'AC ELECTRICAL SERVICES - OSP',
                uom: 'ACTUAL',
                price: 1
            }
        ]);
    });

    test('joins code fragments split from the price column', () => {
        const rows = parsePriceSheetText(`ASPHALT RMV & RESTORE <=\t6in\tASPHALT RMV & RESTORE <=\t$22.08
CONCRETE POUR\tPAD\tCONCRETE POUR\t$43.40`);

        expect(rows).toEqual([
            {
                code: 'ASPHALT RMV & RESTORE <= 6in',
                description: 'ASPHALT RMV & RESTORE <=',
                uom: '',
                price: 22.08
            },
            {
                code: 'CONCRETE POUR PAD',
                description: 'CONCRETE POUR',
                uom: '',
                price: 43.4
            }
        ]);
    });

    test('parses a two-column Unit and Price table', () => {
        expect(parsePriceSheetText(`Unit\tPrice
AC ELECTRICAL SERVICES - OSP\t$1.00
ASPHALT RMV & RESTORE <=\t$22.08`)).toEqual([
            {
                code: 'AC ELECTRICAL SERVICES - OSP',
                description: 'AC ELECTRICAL SERVICES - OSP',
                uom: '',
                price: 1
            },
            {
                code: 'ASPHALT RMV & RESTORE <=',
                description: 'ASPHALT RMV & RESTORE <=',
                uom: '',
                price: 22.08
            }
        ]);
    });

    test('ignores blank lines and invalid rows', () => {
        expect(parsePriceSheetText('\n\n   \n')).toEqual([]);
        expect(parsePriceSheetLine('not a valid row')).toBeNull();
    });
});
