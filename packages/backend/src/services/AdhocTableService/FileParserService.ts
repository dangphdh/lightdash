/**
 * File parser service for handling CSV and Excel file uploads
 */
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { ColumnInference } from './types';

export class FileParserService {
    /**
     * Parse CSV file and infer column types
     */
    static async parseCSV(
        buffer: Buffer,
    ): Promise<{
        headers: string[];
        rows: Record<string, unknown>[];
        columns: ColumnInference[];
    }> {
        const text = buffer.toString('utf-8');
        
        return new Promise((resolve, reject) => {
            Papa.parse(text, {
                complete: (results: Papa.ParseResult<Record<string, unknown>>) => {
                    if (!results.data || results.data.length === 0) {
                        reject(new Error('CSV file is empty'));
                        return;
                    }

                    const rows = results.data as Record<string, unknown>[];
                    const headers = Object.keys(rows[0] || {});

                    const columns = this.inferColumnTypes(rows, headers);

                    resolve({
                        headers,
                        rows,
                        columns,
                    });
                },
                error: (error: Papa.ParseError) => {
                    reject(new Error(`CSV parsing failed: ${error.message}`));
                },
                header: true,
                skipEmptyLines: true,
            });
        });
    }

    /**
     * Parse Excel file and infer column types
     */
    static async parseExcel(
        buffer: Buffer,
    ): Promise<{
        headers: string[];
        rows: Record<string, unknown>[];
        columns: ColumnInference[];
    }> {
        try {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];

            if (!sheet) {
                throw new Error('Excel file has no sheets');
            }

            const rows = XLSX.utils.sheet_to_json(sheet) as Record<
                string,
                unknown
            >[];

            if (rows.length === 0) {
                throw new Error('Excel sheet is empty');
            }

            const headers = Object.keys(rows[0] || {});
            const columns = this.inferColumnTypes(rows, headers);

            return {
                headers,
                rows,
                columns,
            };
        } catch (error) {
            throw new Error(
                `Excel parsing failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Infer column types from row data
     */
    private static inferColumnTypes(
        rows: Record<string, unknown>[],
        headers: string[],
    ): ColumnInference[] {
        const columns: ColumnInference[] = [];

        for (const header of headers) {
            const sampleValues = rows
                .slice(0, 100)
                .map((row) => row[header])
                .filter((val) => val !== null && val !== undefined && val !== '');

            const type = this.detectColumnType(sampleValues);

            columns.push({
                name: header,
                type,
                displayType: this.mapToWarehouseType(type),
                nullable: sampleValues.length < rows.length,
                sampleValues: sampleValues.slice(0, 5),
            });
        }

        return columns;
    }

    /**
     * Detect column type from sample values
     */
    private static detectColumnType(
        values: unknown[],
    ): 'string' | 'number' | 'date' | 'boolean' {
        if (values.length === 0) return 'string';

        const typeScores = {
            number: 0,
            date: 0,
            boolean: 0,
            string: 0,
        };

        for (const value of values) {
            const strValue = String(value).trim().toLowerCase();

            // Check boolean
            if (
                strValue === 'true' ||
                strValue === 'false' ||
                strValue === '1' ||
                strValue === '0' ||
                strValue === 'yes' ||
                strValue === 'no'
            ) {
                typeScores.boolean += 1;
            }

            // Check number
            if (!isNaN(Number(strValue)) && strValue !== '') {
                typeScores.number += 1;
            }

            // Check date (ISO 8601, common formats)
            if (this.isValidDate(strValue)) {
                typeScores.date += 1;
            }

            typeScores.string += 1;
        }

        // Determine the most likely type
        const threshold = values.length * 0.8;

        if (typeScores.boolean >= threshold) return 'boolean';
        if (typeScores.date >= threshold) return 'date';
        if (typeScores.number >= threshold) return 'number';

        return 'string';
    }

    /**
     * Validate if string is a date
     */
    private static isValidDate(str: string): boolean {
        const dateFormats = [
            /^\d{4}-\d{2}-\d{2}/, // ISO 8601: YYYY-MM-DD
            /^\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
            /^\d{1,2}-\d{1,2}-\d{2,4}/, // DD-MM-YY(YY)
            /^\d{1,2}\.\d{1,2}\.\d{2,4}/, // DD.MM.YY(YY)
        ];

        return dateFormats.some((format) => format.test(str));
    }

    /**
     * Map inferred type to warehouse-specific types
     */
    private static mapToWarehouseType(
        type: 'string' | 'number' | 'date' | 'boolean',
    ): string {
        const mapping: Record<string, string> = {
            string: 'STRING',
            number: 'NUMERIC',
            date: 'TIMESTAMP',
            boolean: 'BOOLEAN',
        };

        return mapping[type] || 'STRING';
    }
}
