/** Set the name of the OINO ID field (default \_OINOID\_) */

export class OINOSettings {
    /** Name of the synthetic OINO ID field */
    static OINO_ID_FIELD:string = "_OINOID_"
    /** Private key separator of the synthetic OINO ID field */
    static OINO_ID_SEPARATOR:string = "_"
    private static OINO_ID_SEPARATOR_ESCAPED:string = "%"

    /** Name of the OINOSqlFilter-parameter in request */
    static OINO_SQL_FILTER_PARAM:string = "oinosqlfilter"

    /** Name of the OINOSqlOrder-parameter in request */
    static OINO_SQL_ORDER_PARAM:string = "oinosqlorder"

    /** Name of the OINOSqlLimit-parameter in request */
    static OINO_SQL_LIMIT_PARAM:string = "oinosqllimit"

    /** 
     * Set the name of the OINO ID field 
     * @param idField name of the OINO ID field 
     */
    static setOinoIdField(idField: string) {
        if (idField) {
            OINOSettings.OINO_ID_FIELD = idField;
        }
    }

    /** 
     * Set the separator character of the OINO ID field 
     * @param idSeparator character to use as separator of id parts
    */
    static setOinoIdSeparator(idSeparator: string) {
        if (idSeparator && (idSeparator.length == 1)) {
            OINOSettings.OINO_ID_SEPARATOR = idSeparator;
            OINOSettings.OINO_ID_SEPARATOR_ESCAPED = '%' + idSeparator.charCodeAt(0).toString(16);
        }
    }

    /**
     * Print OINO ID for primary key values.
     *
     * @param primaryKeys an array of primary key values.
     * 
     */
    static printOINOId(primaryKeys:string[]):string {
        let result:string = ""
        for (let i=0; i< primaryKeys.length; i++) {
            if (i > 0) {
                result += OINOSettings.OINO_ID_SEPARATOR
            } 
            result += encodeURIComponent(primaryKeys[i] as string).replaceAll(OINOSettings.OINO_ID_SEPARATOR, OINOSettings.OINO_ID_SEPARATOR_ESCAPED)
        }
        return result
    }

    /** 
     * Set the name of the OINOSqlFilter-param field 
     * 
     * @param sqlFilterParam name of the http parameter with `OINOSqlFilter` definition
     * 
     */
    static setOinoSqlFilterParam(sqlFilterParam: string) {
        if (sqlFilterParam) {
            OINOSettings.OINO_SQL_FILTER_PARAM = sqlFilterParam;
        }
    }

    /** 
     * Set the name of the OINOSqlOrder-param field 
     * 
     * @param sqlOrderParam name of the http parameter with `OINOSqlOrder` definition
     * 
     */
    static setOinoSqlOrderParam(sqlOrderParam: string) {
        if (sqlOrderParam) {
            OINOSettings.OINO_SQL_ORDER_PARAM = sqlOrderParam;
        }
    }

    /** 
     * Set the name of the OINOSqlLimit-param field 
     * 
     * @param sqlLimitParam name of the http parameter with `OINOSqlLimit` definition
     * 
     */
    static setOinoSqlLimitParam(sqlLimitParam: string) {
        if (sqlLimitParam) {
            OINOSettings.OINO_SQL_LIMIT_PARAM = sqlLimitParam;
        }
    }
}
