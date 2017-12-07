const lodash = require('lodash')
const {Task} = require('./task')
const helpers = require('./helpers')


// Main program

async function main() {

  // Arguments
  const argv = process.argv.slice(process.argv[0].endsWith('node') ? 2 : 1)

  // Path argument
  let path = 'run.yml'
  if (argv.includes('--run-path')) {
    path = argv[argv.indexOf('--run-path') + 1]
    lodash.pull(argv, '--run-path', path)
  }

  // Complete argument
  let complete = false
  if (argv.includes('--run-complete')) {
    lodash.pull(argv, '--run-complete')
    complete = True
  }

  // Prepare
  const {config, options} = helpers.readConfig(path)
  const task = new Task(config, {options})

  // Complete
  if (complete) {
    task.complete(argv)
    process.exit()
  }

  // Run
  task.run(argv)

}

main().catch(error => console.log(error))
