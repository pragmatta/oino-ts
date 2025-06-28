import { OINOContentType } from "@oino-ts/common";
export { OINOContentType };
export { OINO_ERROR_PREFIX, OINO_WARNING_PREFIX, OINO_INFO_PREFIX, OINO_DEBUG_PREFIX, OINOStr, OINOBenchmark, OINOMemoryBenchmark, OINOLog, OINOLogLevel, OINOConsoleLog, OINOResult, OINOHttpResult, OINOHtmlTemplate } from "@oino-ts/common";
export { OINODbApiResult, OINODbHtmlTemplate, OINODbApi } from "./OINODbApi.js";
export { OINODbDataModel } from "./OINODbDataModel.js";
export { OINODbModelSet } from "./OINODbModelSet.js";
export { OINODbDataField, OINOBooleanDataField, OINONumberDataField, OINOStringDataField, OINOBlobDataField, OINODatetimeDataField } from "./OINODbDataField.js";
export { OINODbDataSet, OINODbMemoryDataSet, OINODb } from "./OINODb.js";
export { OINODbSqlFilter, OINODbSqlOrder, OINODbSqlComparison, OINODbSqlLimit, OINODbSqlBooleanOperation, OINODbSqlAggregate, OINODbSqlAggregateFunctions, OINODbSqlSelect } from "./OINODbSqlParams.js";
export { OINODbConfig } from "./OINODbConfig.js";
export { OINODbFactory } from "./OINODbFactory.js";
export { OINODbSwagger } from "./OINODbSwagger.js";
export { OINODbParser } from "./OINODbParser.js";
/** Empty row instance */
export const OINODB_EMPTY_ROW = [];
/** Empty row array instance */
export const OINODB_EMPTY_ROWS = [OINODB_EMPTY_ROW];
/** Constant for undefined values */
export const OINODB_UNDEFINED = ""; // original idea was to have a defined literal that get's swapped back to undefined, but current implementation just leaves it out at serialization (so value does not matter)
