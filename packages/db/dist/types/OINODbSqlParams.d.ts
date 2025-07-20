import { OINODbDataField, OINODbDataModel } from "./index.js";
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
     * Constructor for `OINODbSqlFilter` as parser of http parameter.
     *
     * Supports three types of statements:
     * - comparison: (field)-lt|le|eq|ge|gt|like(value)
     * - negation: -not(filter)
     * - conjunction/disjunction: (filter)-and|or(filter)
     *
     * @param filterString string representation of filter from HTTP-request
     *
     */
    static parse(filterString: string): OINODbSqlFilter;
    /**
     * Construct a new `OINODbSqlFilter` as combination of (boolean and/or) of two filters.
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
     * Supports comma separated list of column orders formatted as :
     * - `column` - order by column in ascending order
     * - `column ASC|DESC` - order by single either ascending or descending order
     * - `column+|-` - order by single either ascending or descending order
     *
     * @param orderString string representation of order from HTTP-request
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
     * @param page page number to return starting from 1
     *
     */
    constructor(limit: number, page?: number);
    /**
     * Constructor for `OINODbSqlLimit` as parser of http parameter.
     *
     * Supports limit and page formatted as:
     * - `limit` - limit number of items to return
     * - `limit page n` - limit number of items to return and return page n (starting from 1)
     * - `limit.n` - limit number of items to return and return page n (starting from 1)
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
/**
 * Supported aggregation functions in OINODbSqlAggregate.
 * @enum
 */
export declare enum OINODbSqlAggregateFunctions {
    count = "count",
    sum = "sum",
    avg = "avg",
    min = "min",
    max = "max"
}
/**
 * Class for limiting the number of results.
 *
 */
export declare class OINODbSqlAggregate {
    private static _aggregateRegex;
    private _functions;
    private _fields;
    /**
     * Constructor for `OINODbSqlAggregate`.
     *
     * @param functions aggregate function to use
     * @param fields fields to aggregate
     *
     */
    constructor(functions: OINODbSqlAggregateFunctions[], fields: string[]);
    /**
     * Constructor for `OINODbSqlAggregate` as parser of http parameter.
     *
     * Supports comma separated list of aggregates formatted as:
     * - `function(field)`
     *
     * Supported functions are count, sum, avg, min, max.
     *
     * @param aggregatorString string representation of limit from HTTP-request
     *
     */
    static parse(aggregatorString: string): OINODbSqlAggregate;
    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty(): boolean;
    /**
     * Print non-aggregated fields as SQL GROUP BY-condition based on the datamodel of the API.
     *
     * @param dataModel data model (and database) to use for formatting of values
     * @param select what fields to select
     *
     */
    toSql(dataModel: OINODbDataModel, select?: OINODbSqlSelect): string;
    /**
     * Print non-aggregated fields as SQL GROUP BY-condition based on the datamodel of the API.
     *
     * @param dataModel data model (and database) to use for formatting of values
     * @param select what fields to select
     *
     */
    printSqlColumnNames(dataModel: OINODbDataModel, select?: OINODbSqlSelect): string;
    /**
     * Does filter contain any valid conditions.
     *
     * @param field field to check if it is aggregated
     */
    isAggregated(field: OINODbDataField): boolean;
}
/**
 * Class for ordering select results on a number of columns.
 *
 */
export declare class OINODbSqlSelect {
    private _columns;
    /**
     * Constructor for `OINODbSqlSelect`.
     *
     * @param columns array of columns to select
     *
     */
    constructor(columns: string[]);
    /**
     * Constructor for `OINODbSqlSelect` as parser of http parameter.
     *
     * @param columns comma separated string selected columns from HTTP-request
     *
     */
    static parse(columns: string): OINODbSqlSelect;
    /**
     * Does select contain any valid columns.
     *
     */
    isEmpty(): boolean;
    /**
     * Does select include given column.
     *
     * @param field field to check if it is selected
     *
     */
    isSelected(field: OINODbDataField): boolean;
}
