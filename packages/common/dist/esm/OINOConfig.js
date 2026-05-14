/** Set the name of the OINO ID field (default \_OINOID\_) */
export class OINOConfig {
    /** Name of the synthetic OINO ID field */
    static OINO_ID_FIELD = "_OINOID_";
    /** Private key separator of the synthetic OINO ID field */
    static OINO_ID_SEPARATOR = "_";
    static OINO_ID_SEPARATOR_ESCAPED = "%5F"; // url-encoded "_"
    /** Name of the OINODbQueryFilter-parameter in request */
    static OINO_QUERY_FILTER_PARAM = "oinoqueryfilter";
    /** Name of the OINODbQueryOrder-parameter in request */
    static OINO_QUERY_ORDER_PARAM = "oinoqueryorder";
    /** Name of the OINODbQueryLimit-parameter in request */
    static OINO_QUERY_LIMIT_PARAM = "oinoquerylimit";
    /** Name of the OINODbQueryAggregate-parameter in request */
    static OINO_QUERY_AGGREGATE_PARAM = "oinoqueryaggregate";
    /** Name of the OINODbSqlSelect-parameter in request */
    static OINO_QUERY_SELECT_PARAM = "oinoqueryselect";
    /**
     * Set the name of the OINO ID field
     * @param idField name of the OINO ID field
     */
    static setOinoIdField(idField) {
        if (idField) {
            OINOConfig.OINO_ID_FIELD = idField;
        }
    }
    /**
     * Set the separator character of the OINO ID field
     * @param idSeparator character to use as separator of id parts
    */
    static setOinoIdSeparator(idSeparator) {
        if (idSeparator && (idSeparator.length == 1)) {
            OINOConfig.OINO_ID_SEPARATOR = idSeparator;
            OINOConfig.OINO_ID_SEPARATOR_ESCAPED = '%' + idSeparator.charCodeAt(0).toString(16).toUpperCase();
        }
    }
    /**
     * Print OINO ID for primary key values.
     *
     * @param primaryKeys an array of primary key values.
     *
     */
    static printOINOId(primaryKeys) {
        let result = "";
        for (let i = 0; i < primaryKeys.length; i++) {
            if (i > 0) {
                result += OINOConfig.OINO_ID_SEPARATOR;
            }
            result += encodeURIComponent(primaryKeys[i]).replaceAll(OINOConfig.OINO_ID_SEPARATOR, OINOConfig.OINO_ID_SEPARATOR_ESCAPED); // force encoding of _ and other non-encoded separators
        }
        return result;
    }
    /**
     * Print OINO ID for primary key values.
     *
     * @param oinoid the OINO ID string to parse as primary key values.
     *
     */
    static parseOINOId(oinoid) {
        let result = [];
        const parts = oinoid.split(OINOConfig.OINO_ID_SEPARATOR);
        for (const part of parts) {
            result.push(decodeURIComponent(part));
        }
        return result;
    }
    /**
     * Set the name of the OINODbQueryFilter-param field
     *
     * @param sqlFilterParam name of the http parameter with `OINODbQueryFilter` definition
     *
     */
    static setOinoQueryFilterParam(sqlFilterParam) {
        if (sqlFilterParam) {
            OINOConfig.OINO_QUERY_FILTER_PARAM = sqlFilterParam;
        }
    }
    /**
     * Set the name of the OINODbQueryOrder-param field
     *
     * @param sqlOrderParam name of the http parameter with `OINODbQueryOrder` definition
     *
     */
    static setOinoQueryOrderParam(sqlOrderParam) {
        if (sqlOrderParam) {
            OINOConfig.OINO_QUERY_ORDER_PARAM = sqlOrderParam;
        }
    }
    /**
     * Set the name of the OINODbQueryLimit-param field
     *
     * @param sqlLimitParam name of the http parameter with `OINODbQueryLimit` definition
     *
     */
    static setOinoQueryLimitParam(sqlLimitParam) {
        if (sqlLimitParam) {
            OINOConfig.OINO_QUERY_LIMIT_PARAM = sqlLimitParam;
        }
    }
}
