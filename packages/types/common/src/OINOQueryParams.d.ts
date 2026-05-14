/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
export declare enum OINOQueryBooleanOperation {
    and = "and",
    or = "or",
    not = "not"
}
/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
export declare enum OINOQueryComparison {
    lt = "lt",
    le = "le",
    eq = "eq",
    ne = "ne",
    ge = "ge",
    gt = "gt",
    like = "like"
}
/**
 * Supported logical conjunctions in filter predicates.
 * @enum
 */
export declare enum OINOQueryNullCheck {
    isnull = "isnull",
    isNotNull = "isNotNull"
}
/**
 * Supported aggregation functions in OINODbQueryAggregate.
 * @enum
 */
export declare enum OINOQueryAggregateFunctions {
    count = "count",
    sum = "sum",
    avg = "avg",
    min = "min",
    max = "max"
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
export declare class OINOQueryFilter {
    protected static _booleanOperationRegex: RegExp;
    protected static _negationRegex: RegExp;
    protected static _filterComparisonRegex: RegExp;
    protected static _filterNullCheckRegex: RegExp;
    readonly leftSide: OINOQueryFilter | string;
    readonly rightSide: OINOQueryFilter | string;
    readonly operator: OINOQueryComparison | OINOQueryBooleanOperation | OINOQueryNullCheck | null;
    /**
     * Constructor of `OINOQueryFilter`
     * @param leftSide left side of the filter, either another filter or a column name
     * @param operation operation of the filter, either `OINOQueryComparison` or `OINOQueryBooleanOperation`
     * @param rightSide right side of the filter, either another filter or a value
     */
    constructor(leftSide: OINOQueryFilter | string, operation: OINOQueryComparison | OINOQueryBooleanOperation | OINOQueryNullCheck | null, rightSide: OINOQueryFilter | string);
    /**
     * Constructor for `OINOQueryFilter` as parser of http parameter.
     *
     * Supports three types of statements:
     * - comparison: (field)-lt|le|eq|ge|gt|like(value)
     * - negation: -not(filter)
     * - conjunction/disjunction: (filter)-and|or(filter)
     * - null check: -isnull(field) or -isNotNull(field)
     *
     * @param filterString string representation of filter from HTTP-request
     *
     */
    static parse(filterString: string): OINOQueryFilter;
    /**
     * Construct a new `OINOQueryFilter` as combination of (boolean and/or) of two filters.
     *
     * @param leftSide left side to combine
     * @param operation boolean operation to use in combination
     * @param rightSide right side to combine
     *
     */
    static combine(leftSide: OINOQueryFilter | undefined, operation: OINOQueryBooleanOperation, rightSide: OINOQueryFilter | undefined): OINOQueryFilter | undefined;
    /**
     * Combine two filters with an AND operation.
     *
     * @param leftSide left side filter
     * @param rightSide right side filter
     *
     */
    static and(leftSide: OINOQueryFilter, rightSide: OINOQueryFilter): OINOQueryFilter | undefined;
    /**
     * Combine two filters with an OR operation.
     *
     * @param leftSide left side filter
     * @param rightSide right side filter
     *
     */
    static or(leftSide: OINOQueryFilter, rightSide: OINOQueryFilter): OINOQueryFilter | undefined;
    /**
     * Negate a filter with a NOT operation.
     *
     * @param leftSide left side filter
     *
     */
    static not(leftSide: OINOQueryFilter): OINOQueryFilter | undefined;
    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty(): boolean;
}
/**
 * Class for ordering select results on a number of columns.
 *
 */
export declare class OINOQueryOrder {
    protected static _orderColumnRegex: RegExp;
    readonly columns: string[];
    readonly descending: boolean[];
    /**
     * Constructor for `OINOQueryOrder`.
     *
     * @param column_or_array single or array of columns to order on
     * @param descending_or_array single or array of booleans if ordes is descending
     *
     */
    constructor(column_or_array: string[] | string, descending_or_array: boolean[] | boolean);
    /**
     * Constructor for `OINOQueryOrder` as parser of http parameter.
     *
     * Supports comma separated list of column orders formatted as :
     * - `column` - order by column in ascending order
     * - `column ASC|DESC` - order by single either ascending or descending order
     * - `column+|-` - order by single either ascending or descending order
     *
     * @param orderString string representation of order from HTTP-request
     *
     */
    static parse(orderString: string): OINOQueryOrder;
    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty(): boolean;
}
/**
 * Class for limiting the number of results.
 *
 */
export declare class OINOQueryLimit {
    protected static _limitRegex: RegExp;
    readonly limit: number;
    readonly page: number;
    /**
     * Constructor for `OINOQueryLimit`.
     *
     * @param limit maximum number of items to return
     * @param page page number to return starting from 1
     *
     */
    constructor(limit: number, page?: number);
    /**
     * Constructor for `OINOQueryLimit` as parser of http parameter.
     *
     * Supports limit and page formatted as:
     * - `limit` - limit number of items to return
     * - `limit page n` - limit number of items to return and return page n (starting from 1)
     * - `limit.n` - limit number of items to return and return page n (starting from 1)
     *
     * @param limitString string representation of limit from HTTP-request
     *
     */
    static parse(limitString: string): OINOQueryLimit;
    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty(): boolean;
}
/**
 * Class for limiting the number of results.
 *
 */
export declare class OINOQueryAggregate {
    protected static _aggregateRegex: RegExp;
    readonly functions: OINOQueryAggregateFunctions[];
    readonly fields: string[];
    /**
     * Constructor for `OINOQueryAggregate`.
     *
     * @param functions aggregate function to use
     * @param fields fields to aggregate
     *
     */
    constructor(functions: OINOQueryAggregateFunctions[], fields: string[]);
    /**
     * Constructor for `OINOQueryAggregate` as parser of http parameter.
     *
     * Supports comma separated list of aggregates formatted as:
     * - `function(field)`
     *
     * Supported functions are count, sum, avg, min, max.
     *
     * @param aggregatorString string representation of limit from HTTP-request
     *
     */
    static parse(aggregatorString: string): OINOQueryAggregate;
    /**
     * Does filter contain any valid conditions.
     *
     */
    isEmpty(): boolean;
    /**
     * Does filter contain any valid conditions.
     *
     * @param field field to check if it is aggregated
     */
    isAggregated(field: string): boolean;
}
/**
 * Class for ordering select results on a number of columns.
 *
 */
export declare class OINOQuerySelect {
    readonly columns: string[];
    /**
     * Constructor for `OINOQuerySelect`.
     *
     * @param columns array of columns to select
     *
     */
    constructor(columns: string[]);
    /**
     * Constructor for `OINOQuerySelect` as parser of http parameter.
     *
     * @param columns comma separated string selected columns from HTTP-request
     *
     */
    static parse(columns: string): OINOQuerySelect;
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
    isSelected(field: string): boolean;
}
/** Request options */
export type OINOQueryParams = {
    /** Additional SQL select where-conditions */
    filter?: OINOQueryFilter;
    /** SQL result ordering conditions */
    order?: OINOQueryOrder;
    /** SQL result limit condition */
    limit?: OINOQueryLimit;
    /** SQL aggregation functions */
    aggregate?: OINOQueryAggregate;
    /** SQL select condition */
    select?: OINOQuerySelect;
};
