import { OINODbDataSet, OINODbDataModel, OINOContentType, OINODataCell, OINODbSqlParams } from "./index.js";
/**
 * Class for dataset based on a data model that can be serialized to
 * a supported format:
 * - JSON (application/json)
 * - CSV (text/csv)
 *
 */
export declare class OINODbModelSet {
    /** Reference to datamodel */
    readonly datamodel: OINODbDataModel;
    /** Reference to data set */
    readonly dataset: OINODbDataSet;
    /** SQL parameters */
    readonly sqlParams?: OINODbSqlParams;
    /** Collection of errors */
    errors: string[];
    /**
     * Constructor for `OINODbModelSet`.
     *
     * @param datamodel data model
     * @param dataset data set
     * @param sqlParams SQL parameters
     */
    constructor(datamodel: OINODbDataModel, dataset: OINODbDataSet, sqlParams?: OINODbSqlParams);
    private _encodeAndHashFieldValue;
    private _writeRowJson;
    private _writeStringJson;
    private _writeHeaderCsv;
    private _writeRowCsv;
    private _writeStringCsv;
    private _writeRowFormdataParameterBlock;
    private _writeRowFormdataFileBlock;
    private _writeRowFormdata;
    private _writeStringFormdata;
    private _writeRowUrlencode;
    private _writeStringUrlencode;
    private _exportRow;
    /**
     * Serialize model set in the given format.
     *
     * @param [contentType=OINOContentType.json] serialization content type
     *
     */
    writeString(contentType?: OINOContentType): Promise<string>;
    /**
     * Get value of given field in the current row. Undefined if no rows,
     * field not found or value does not exist.
     *
     * @param fieldName name of the field
     * @param serialize serialize the value
     *
     */
    getValueByFieldName(fieldName: string, serialize?: boolean): OINODataCell;
    /**
     * Export all rows as a record with OINOId as key and object with row cells as values.
     *
     */
    exportAsRecord(): Promise<Record<string, any>>;
}
