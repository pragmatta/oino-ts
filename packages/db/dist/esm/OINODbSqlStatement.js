/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
/**
 * A SQL statement being assembled together with the ordered bind values its placeholders refer to.
 *
 * This is both the *builder* used while a statement is being constructed and the finished
 * *statement* that gets executed: `addFieldValue` is called during assembly to append a value and
 * get back the placeholder token to embed in `sql`, and once assembly is done `sql` + `values`
 * are handed to `OINODb.runStatement`.
 *
 * A statement can be built in one of two modes:
 * - parameterized (default): values are collected into `values` and `addFieldValue` returns a
 *   database-specific bind placeholder (`$1`, `?`, `@p0`, …). This is the safe path used by the
 *   `build*Statement` methods and `runStatement`.
 * - legacy / inline: `values` stays empty and `addFieldValue` returns an escaped inline SQL literal.
 *   Used only by the deprecated `printSql*` string methods that are kept for backwards compatibility.
 *
 * Values are added in the same left-to-right order the placeholders appear in the final SQL so that
 * positional binding (Postgres `$n`, MySQL/SQLite `?`) stays aligned.
 *
 */
export class OINODbSqlStatement {
    /** Assembled SQL text (with bind placeholders in parameterized mode, inline literals in legacy mode) */
    sql = "";
    /** Ordered bind values corresponding to the placeholders in `sql` (empty in legacy mode) */
    values = [];
    _db;
    _parameterized;
    /**
     * Constructor of `OINODbSqlStatement`.
     *
     * @param db database whose placeholder syntax and bind-value coercion to use
     * @param parameterized whether values are collected as bind parameters (true) or inlined as
     *        escaped literals (false, legacy)
     *
     */
    constructor(db, parameterized = true) {
        this._db = db;
        this._parameterized = parameterized;
    }
    /** Whether this statement collects bind parameters (true) or inlines literals (false). */
    get isParameterized() {
        return this._parameterized;
    }
    /**
     * Append a field value to the statement and return the SQL fragment to embed in its place.
     *
     * In parameterized mode the value is coerced via `field.bindCellValue`, pushed onto `values`,
     * and a bind placeholder token is returned. In legacy mode an escaped inline literal is returned
     * and `values` is left untouched.
     *
     * @param field field the value belongs to (provides native type / coercion / escaping)
     * @param cell cell value to add
     *
     */
    addFieldValue(field, cell) {
        if (this._parameterized) {
            const token = this._db.printParameterName(this.values.length);
            this.values.push(field.bindCellValue(cell));
            return token;
        }
        else {
            return field.printCellAsValue(cell);
        }
    }
}
