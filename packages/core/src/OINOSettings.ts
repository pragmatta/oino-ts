/** Set the name of the OINO ID field (default \_OINOID\_) */

export class OINOSettings {
    /** Name of the synthetic OINO ID field */
    static OINO_ID_FIELD:string = "_OINOID_"
    /** Private key separator of the synthetic OINO ID field */
    static OINO_ID_SEPARATOR:string = "_"
    private static OINO_ID_SEPARATOR_ESCAPED:string = "%"


    /** Set the name of the OINO ID field */
    static setIdField(idField: string) {
        if (idField) {
            OINOSettings.OINO_ID_FIELD = idField;
        }
    }

    /** Set the separator character of the OINO ID field */
    static setIdSeparator(idSeparator: string) {
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
}
