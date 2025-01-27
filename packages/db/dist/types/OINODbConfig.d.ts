/** Set the name of the OINO ID field (default \_OINOID\_) */
export declare class OINODbConfig {
    /** Name of the synthetic OINO ID field */
    static OINODB_ID_FIELD: string;
    /** Private key separator of the synthetic OINO ID field */
    static OINODB_ID_SEPARATOR: string;
    private static OINODB_ID_SEPARATOR_ESCAPED;
    /** Name of the OINODbSqlFilter-parameter in request */
    static OINODB_SQL_FILTER_PARAM: string;
    /** Name of the OINODbSqlOrder-parameter in request */
    static OINODB_SQL_ORDER_PARAM: string;
    /** Name of the OINODbSqlLimit-parameter in request */
    static OINODB_SQL_LIMIT_PARAM: string;
    /** Name of the OINODbSqlAggregate-parameter in request */
    static OINODB_SQL_AGGREGATE_PARAM: string;
    /**
     * Set the name of the OINO ID field
     * @param idField name of the OINO ID field
     */
    static setOinoIdField(idField: string): void;
    /**
     * Set the separator character of the OINO ID field
     * @param idSeparator character to use as separator of id parts
    */
    static setOinoIdSeparator(idSeparator: string): void;
    /**
     * Print OINO ID for primary key values.
     *
     * @param primaryKeys an array of primary key values.
     *
     */
    static printOINOId(primaryKeys: string[]): string;
    /**
     * Set the name of the OINODbSqlFilter-param field
     *
     * @param sqlFilterParam name of the http parameter with `OINODbSqlFilter` definition
     *
     */
    static setOinoSqlFilterParam(sqlFilterParam: string): void;
    /**
     * Set the name of the OINODbSqlOrder-param field
     *
     * @param sqlOrderParam name of the http parameter with `OINODbSqlOrder` definition
     *
     */
    static setOinoSqlOrderParam(sqlOrderParam: string): void;
    /**
     * Set the name of the OINODbSqlLimit-param field
     *
     * @param sqlLimitParam name of the http parameter with `OINODbSqlLimit` definition
     *
     */
    static setOinoSqlLimitParam(sqlLimitParam: string): void;
}
