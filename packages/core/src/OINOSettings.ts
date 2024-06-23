/** Set the name of the OINO ID field (default \_OINOID\_) */

export class OINOSettings {
    /** Name of the synthetic OINO ID field */
    static OINO_ID_FIELD:string = "_OINOID_"
    /** Private key separator of the synthetic OINO ID field */
    static OINO_ID_SEPARATOR:string = "-"
    static OINO_ID_SEPARATOR_ESCAPED:string = "%2d"


    static setIdField(idField: string) {
        if (idField) {
            OINOSettings.OINO_ID_FIELD = idField;
        }
    }
    /** Set the separator character of the OINO ID field (default -) */

    static setIdSeparator(idSeparator: string) {
        if (idSeparator && (idSeparator.length == 1)) {
            OINOSettings.OINO_ID_SEPARATOR = idSeparator;
            OINOSettings.OINO_ID_SEPARATOR_ESCAPED = '%' + idSeparator.charCodeAt(0).toString(16);
        }
    }
}
