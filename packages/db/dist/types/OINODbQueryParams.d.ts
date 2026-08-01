import { OINOQueryFilter, OINOQueryOrder, OINOQueryLimit, OINOQueryAggregate, OINOQuerySelect, OINODataModel } from "@oino-ts/common";
import { OINODbDataModel } from "./OINODbDataModel.js";
import { OINODbSqlStatement } from "./OINODbSqlStatement.js";
/**
 * Class for recursively parsing of filters and printing them as SQL conditions.
 * Supports three types of statements
 * - comparison: (field)-lt|le|eq|ge|gt|like(value)
 * - negation: -not(filter)
 * - conjunction/disjunction: (filter)-and|or(filter)
 * Supported conditions are comparisons (<, <=, =, >=, >) and substring match (LIKE).
 *
 */
export declare class OINODbQueryFilter extends OINOQueryFilter {
    private static operatorToSql;
    /**
     * Build filter as SQL condition based on the datamodel of the API, appending any values to the
     * given statement.
     *
     * Column names are validated against the datamodel and values are added to `statement`
     * (bound as parameters, or inlined as escaped literals when the statement is in legacy mode).
     *
     * @param filter filter to build
     * @param dataModel data model (and database) to use for formatting of values
     * @param statement statement being assembled (collects bind values / provides placeholders)
     *
     */
    static buildSql(filter: OINOQueryFilter, dataModel: OINODbDataModel, statement: OINODbSqlStatement): string;
    /**
     * Print filter as an inline (non-parameterized) SQL condition string.
     *
     * @deprecated Prefer `buildSql` with a parameterized `OINODbSqlStatement`.
     *
     * @param filter filter to print
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    static printSql(filter: OINOQueryFilter, dataModel: OINODbDataModel): string;
}
/**
 * Class for ordering select results on a number of columns.
 *
 */
export declare class OINODbQueryOrder extends OINOQueryOrder {
    /**
     * Print order as SQL condition based on the datamodel of the API.
     *
     * @param order order instance
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    static printSql(order: OINOQueryOrder, dataModel: OINODbDataModel): string;
}
/**
 * Class for limiting the number of results.
 *
 */
export declare class OINODbQueryLimit extends OINOQueryLimit {
    /**
     * Print order as SQL condition based on the datamodel of the API.
     *
     * @param limit limit instance
     * @param dataModel data model (and database) to use for formatting of values
     *
     */
    static printSql(limit: OINOQueryLimit, dataModel: OINODbDataModel): string;
}
/**
 * Class for limiting the number of results.
 *
 */
export declare class OINODbQueryAggregate extends OINOQueryAggregate {
    /**
     * Print non-aggregated fields as SQL GROUP BY-condition based on the datamodel of the API.
     *
     * @param aggregate aggregate instance
     * @param dataModel data model (and database) to use for formatting of values
     * @param select what fields to select
     *
     */
    static printSql(aggregate: OINOQueryAggregate, dataModel: OINODataModel, select?: OINOQuerySelect): string;
    /**
     * Print non-aggregated fields as SQL GROUP BY-condition based on the datamodel of the API.
     *
     * @param dataModel data model (and database) to use for formatting of values
     * @param select what fields to select
     *
     */
    static printColumnNames(aggregate: OINOQueryAggregate, dataModel: OINODataModel, select?: OINOQuerySelect): string;
}
