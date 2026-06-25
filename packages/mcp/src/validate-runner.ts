import { runMcpValidation } from './validate.ts'

const failures = await runMcpValidation()
if (failures.length > 0) {
  console.error('MCP validation failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('MCP validation passed')
