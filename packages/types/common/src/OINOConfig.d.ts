/** Set the name of the OINO ID field (default \_OINOID\_) */
export declare class OINOConfig {
    /** Name of the synthetic OINO ID field */
    static OINO_ID_FIELD: string;
    /** Private key separator of the synthetic OINO ID field */
    static OINO_ID_SEPARATOR: string;
    private static OINO_ID_SEPARATOR_ESCAPED;
    /** Name of the OINODbQueryFilter-parameter in request */
    static OINO_QUERY_FILTER_PARAM: string;
    /** Name of the OINODbQueryOrder-parameter in request */
    static OINO_QUERY_ORDER_PARAM: string;
    /** Name of the OINODbQueryLimit-parameter in request */
    static OINO_QUERY_LIMIT_PARAM: string;
    /** Name of the OINODbQueryAggregate-parameter in request */
    static OINO_QUERY_AGGREGATE_PARAM: string;
    /** Name of the OINODbSqlSelect-parameter in request */
    static OINO_QUERY_SELECT_PARAM: string;
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
     * Print OINO ID for primary key values.
     *
     * @param oinoid the OINO ID string to parse as primary key values.
     *
     */
    static parseOINOId(oinoid: string): string[];
    /**
     * Set the name of the OINODbQueryFilter-param field
     *
     * @param sqlFilterParam name of the http parameter with `OINODbQueryFilter` definition
     *
     */
    static setOinoQueryFilterParam(sqlFilterParam: string): void;
    /**
     * Set the name of the OINODbQueryOrder-param field
     *
     * @param sqlOrderParam name of the http parameter with `OINODbQueryOrder` definition
     *
     */
    static setOinoQueryOrderParam(sqlOrderParam: string): void;
    /**
     * Set the name of the OINODbQueryLimit-param field
     *
     * @param sqlLimitParam name of the http parameter with `OINODbQueryLimit` definition
     *
     */
    static setOinoQueryLimitParam(sqlLimitParam: string): void;
}
