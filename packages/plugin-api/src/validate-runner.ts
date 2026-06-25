import { runPluginValidation } from './validate.ts'

const failures = await runPluginValidation()
if (failures.length > 0) {
  console.error('Plugin validation failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Plugin validation passed')
