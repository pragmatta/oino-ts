export { OINODbApiResult, OINODbHtmlTemplate, OINODbApi, OINODbApiRequest } from "./OINODbApi.js";
export { OINODbDataModel } from "./OINODbDataModel.js";
export { OINODbModelSet } from "./OINODbModelSet.js";
export { OINODbDataField, OINOBooleanDataField, OINONumberDataField, OINOStringDataField, OINOBlobDataField, OINODatetimeDataField } from "./OINODbDataField.js";
export { OINODbDataSet, OINODbMemoryDataSet, OINODb } from "./OINODb.js";
export { OINODbSqlFilter, OINODbSqlOrder, OINODbSqlComparison, OINODbSqlLimit, OINODbSqlBooleanOperation, OINODbSqlAggregate, OINODbSqlAggregateFunctions, OINODbSqlSelect, OINODbSqlNullCheck } from "./OINODbSqlParams.js";
export { OINODbConfig } from "./OINODbConfig.js";
export { OINODbFactory } from "./OINODbFactory.js";
export { OINODbSwagger } from "./OINODbSwagger.js";
export { OINODbParser } from "./OINODbParser.js";
/** Empty row instance */
export const OINODB_EMPTY_ROW = [];
/** Empty row array instance */
export const OINODB_EMPTY_ROWS = [];
/** Constant for undefined values */
export const OINODB_UNDEFINED = ""; // original idea was to have a defined literal that get's swapped back to undefined, but current implementation just leaves it out at serialization (so value does not matter)
