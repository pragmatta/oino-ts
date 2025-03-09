"use strict";
/** Set the name of the OINO ID field (default \_OINOID\_) */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OINODbConfig = void 0;
class OINODbConfig {
    /** Name of the synthetic OINO ID field */
    static OINODB_ID_FIELD = "_OINOID_";
    /** Private key separator of the synthetic OINO ID field */
    static OINODB_ID_SEPARATOR = "_";
    static OINODB_ID_SEPARATOR_ESCAPED = "%";
    /** Name of the OINODbSqlFilter-parameter in request */
    static OINODB_SQL_FILTER_PARAM = "oinosqlfilter";
    /** Name of the OINODbSqlOrder-parameter in request */
    static OINODB_SQL_ORDER_PARAM = "oinosqlorder";
    /** Name of the OINODbSqlLimit-parameter in request */
    static OINODB_SQL_LIMIT_PARAM = "oinosqllimit";
    /** Name of the OINODbSqlAggregate-parameter in request */
    static OINODB_SQL_AGGREGATE_PARAM = "oinosqlaggregate";
    /** Name of the OINODbSqlSelect-parameter in request */
    static OINODB_SQL_SELECT_PARAM = "oinosqlselect";
    /** Name of the OINOContentType-parameter request */
    static OINODB_REQUEST_TYPE = "oinorequesttype";
    /** Name of the OINOContentType-parameter request */
    static OINODB_RESPONSE_TYPE = "oinoresponsetype";
    /**
     * Set the name of the OINO ID field
     * @param idField name of the OINO ID field
     */
    static setOinoIdField(idField) {
        if (idField) {
            OINODbConfig.OINODB_ID_FIELD = idField;
        }
    }
    /**
     * Set the separator character of the OINO ID field
     * @param idSeparator character to use as separator of id parts
    */
    static setOinoIdSeparator(idSeparator) {
        if (idSeparator && (idSeparator.length == 1)) {
            OINODbConfig.OINODB_ID_SEPARATOR = idSeparator;
            OINODbConfig.OINODB_ID_SEPARATOR_ESCAPED = '%' + idSeparator.charCodeAt(0).toString(16);
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
                result += OINODbConfig.OINODB_ID_SEPARATOR;
            }
            result += encodeURIComponent(primaryKeys[i]).replaceAll(OINODbConfig.OINODB_ID_SEPARATOR, OINODbConfig.OINODB_ID_SEPARATOR_ESCAPED);
        }
        return result;
    }
    /**
     * Set the name of the OINODbSqlFilter-param field
     *
     * @param sqlFilterParam name of the http parameter with `OINODbSqlFilter` definition
     *
     */
    static setOinoSqlFilterParam(sqlFilterParam) {
        if (sqlFilterParam) {
            OINODbConfig.OINODB_SQL_FILTER_PARAM = sqlFilterParam;
        }
    }
    /**
     * Set the name of the OINODbSqlOrder-param field
     *
     * @param sqlOrderParam name of the http parameter with `OINODbSqlOrder` definition
     *
     */
    static setOinoSqlOrderParam(sqlOrderParam) {
        if (sqlOrderParam) {
            OINODbConfig.OINODB_SQL_ORDER_PARAM = sqlOrderParam;
        }
    }
    /**
     * Set the name of the OINODbSqlLimit-param field
     *
     * @param sqlLimitParam name of the http parameter with `OINODbSqlLimit` definition
     *
     */
    static setOinoSqlLimitParam(sqlLimitParam) {
        if (sqlLimitParam) {
            OINODbConfig.OINODB_SQL_LIMIT_PARAM = sqlLimitParam;
        }
    }
}
exports.OINODbConfig = OINODbConfig;
