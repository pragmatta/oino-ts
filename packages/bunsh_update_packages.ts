import { $ } from "bun"

const packages = [
  "common",
  "db",
  "db-bunsqlite",
  "db-mariadb",
  "db-mssql",
  "db-postgresql",
  "hashid"
]

const DIST_ROOT = "./_dist"


for (let pkg of packages) {
    await $`echo updating ${pkg}`
    await $`rm -rf ${pkg}/dist 2>&1`
    await $`rm -rf types/${pkg} 2>&1`

    await $`mkdir -p ${pkg}/dist`
    await $`mkdir -p ${pkg}/dist/cjs`
    await $`mkdir -p ${pkg}/dist/esm`
    await $`mkdir -p ${pkg}/dist/types`
    await $`mkdir -p types/${pkg}`
    await $`mkdir -p types/${pkg}/src`
    
    await $`cp ${DIST_ROOT}/cjs/${pkg}/src/* ${pkg}/dist/cjs/`
    await $`cp ${DIST_ROOT}/esm/${pkg}/src/* ${pkg}/dist/esm/`
    await $`cp ${DIST_ROOT}/types/${pkg}/src/* ${pkg}/dist/types/`
    await $`cp ${DIST_ROOT}/types/${pkg}/src/* types/${pkg}/src/`
}
