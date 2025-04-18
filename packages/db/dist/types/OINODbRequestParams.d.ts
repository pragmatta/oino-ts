import { OINODbDataModel } from "./index.js";
/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
export declare enum OINODbSqlBooleanOperation {
    and = "and",
    or = "or",
    not = "not"
}
/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
export declare enum OINODbSqlComparison {
    lt = "lt",
    le = "le",
    eq = "eq",
    ge = "ge",
    gt = "gt",
    like = "like"
}
/**
 * Class for recursively parsing of filters and printing them as SQL conditions.
 * Supports three types of statements
 * - comparison: (field)-lt|le|eq|ge|gt|like(value)
 * - negation: -not(filter)
 * - conjunction/disjunction: (filter)-and|or(filter)
 * Supported conditions are comparisons (<, <=, =, >=, >) and substring match (LIKE).
 *
 */
export declare class OINODbSqlFilter {
    private static _booleanOperationRegex;
    private static _negationRegex;
    private static _filterComparisonRegex;
    private _leftSide;
    private _rightSide;
    private _operator;
    /**
     * Constructor of `OINODbSqlFilter`
     * @param leftSide left side of the filter, either another filter or a column name
     * @param operation operation of the filter, either `OINODbSqlComparison` or `OINODbSqlBooleanOperation`
     * @param rightSide right side of the filter, either another filter or a value
     */
    constructor(leftSide: OINODbSqlFilter | string, operation: OINODbSqlComparison | OINODbSqlBooleanOperation | null, rightSide: OINODbSqlFilter | string);
    /**
     * Constructor for `OINOFilter` as parser of http parameter.
     *
     * @param filterString string representation of filter from HTTP-request
     *
     */
    static parse(filterString: string): OINODbSqlFilter;
    /**
     * Construct a new `OINOFilter` as combination of (boolean and/or) of two filters.
     *
     * @param leftSide left side to combine
     * @param operation boolean operation to use in combination
     * @param rightSide right side to combine
     *
     */
    static combine(leftSide: OINODbSqlFilter | undefined, operation: OINODbSqlBooleanOperation, rightSide: OINODbSqlFilter | undefined): OINODbSqlFilter | undefined;
    private _operatorToSql;
    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty(): boolean;
    /**
     * Print filter as SQL condition based on the datamodel of the API.
     *
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    toSql(dataModel: OINODbDataModel): string;
}
/**
 * Class for ordering select results on a number of columns.
 *
 */
export declare class OINODbSqlOrder {
    private static _orderColumnRegex;
    private _columns;
    private _descending;
    /**
     * Constructor for `OINODbSqlOrder`.
     *
     * @param column_or_array single or array of columns to order on
     * @param descending_or_array single or array of booleans if ordes is descending
     *
     */
    constructor(column_or_array: string[] | string, descending_or_array: boolean[] | boolean);
    /**
     * Constructor for `OINODbSqlOrder` as parser of http parameter.
     *
     * @param orderString string representation of ordering from HTTP-request
     *
     */
    static parse(orderString: string): OINODbSqlOrder;
    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty(): boolean;
    /**
     * Print order as SQL condition based on the datamodel of the API.
     *
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    toSql(dataModel: OINODbDataModel): string;
}
/**
 * Class for limiting the number of results.
 *
 */
export declare class OINODbSqlLimit {
    private static _limitRegex;
    private _limit;
    private _page;
    /**
     * Constructor for `OINODbSqlLimit`.
     *
     * @param limit maximum number of items to return
     *
     */
    constructor(limit: number, page?: number);
    /**
     * Constructor for `OINODbSqlLimit` as parser of http parameter.
     *
     * @param limitString string representation of limit from HTTP-request
     *
     */
    static parse(limitString: string): OINODbSqlLimit;
    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty(): boolean;
    /**
     * Print order as SQL condition based on the datamodel of the API.
     *
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    toSql(dataModel: OINODbDataModel): string;
}
