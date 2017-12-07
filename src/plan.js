const lodash = require('lodash')
const executors = require('./executors')


// Module API

class Plan {

  // Public

  constructor(commands, mode) {
    this._commands = commands
    this._mode = mode
  }

  explain() {

    // Explain
    const lines = []
    let plain = true
    for (command of this._commands) {
      if (['sequence', 'parallel', 'multiplex'].includes(this._mode)) {
        if (!command.variable) {
          if (plain) lines.push(`[${this._mode.toUpperCase()}]`)
          plain = false
        }
      }
      let code = command.code
      if (command.variable) code = '%s="%s"' % (command.variable, command.code)
      lines.push(`${' '.repeat(plain ? 0 : 4)}$ ${code}`)
    }

    return lines.join('\n')

  }

  async execute(argv, {quiet, faketty}) {
    const commands = [...this._commands]

    // Variables
    const varnames = []
    const variables = []
    for (const command of [...commands]) {
      if (command.variable) {
        variables.push(command)
        varnames.push(command.variable)
        lodash.pull(commands, command)
      }
      executors.executeSync(variables, {environ: process.env, quiet})
      if (!commands.length) {
        console.log(process.env[command.variable])
        return
      }
    }

    // Update environ
    process.env.RUNARGS = argv.join(' ')
    const runvars = process.env.RUNVARS
    if (runvars) {
      const dotenv = require('dotenv')
      dotenv.config({path: runvars})
    }

    // Log prepared
    const start = process.hrtime()
    if (!quiet) {
      const items = []
      for (const name of [...varnames, 'RUNARGS']) {
        items.push(`${name}=${process.env[name]}`)
      }
      console.log(`[run] Prepared "${items.join('; ')}"`)
    }

    // Directive
    if (this._mode === 'directive') {
      executors.executeSync(commands, {environ: process.env, quiet})

    // Sequence
    } else if (this._mode === 'sequence') {
      executors.executeSync(commands, {environ: process.env, quiet})

    // Parallel
    } else if (this._mode === 'parallel') {
      await executors.executeAsync(commands, {environ: process.env, quiet, faketty})

    // Multiplex
    } else if (this._mode === 'multiplex') {
      await executors.executeAsync(commands, {
        environ: process.env, multiplex: true, quiet, faketty
      })
    }

    // Log finished
    const stop = process.hrtime(start)
    if (!quiet) {
      const time = (stop[0] + stop[1]/1000000000).toFixed(3)
      console.log(`[run] Finished in ${time} seconds`)
    }

  }
}


// System

module.exports = {
  Plan,
}
