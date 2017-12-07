const chalk = require('chalk')
const {StreamSplitter} = require('stream-splitter')
const {spawn, spawnSync} = require('child_process')
const {applyFaketty} = require('./faketty')
const helpers = require('./helpers')


// Module API

function executeSync(commands, environ, {quiet}={}) {
  for (const command of commands) {

    // Log process
    if (!command.variable && !quiet) {
      console.log(`[run] Launched "${command.code}"`)
    }

    // Execute process
    const stdio = command.variable ? 'pipe' : 'inherit'
    const result = spawnSync(command.code, {shell: true, env: environ, stdio})

    // Failed process
    if (result.status !== 0) {
        const message = `[run] Command "${command.code}" has failed`
        helpers.print_message('general', {message})
        process.exit(1)
    }

    // Update environ
    if (command.variable) {
      environ[command.variable] = result.stdout
    }

  }
}


async function executeAsync(commands, environ, {multiplex, quiet, faketty}={}) {
  return new Promise((resolve, reject) => {
    let closed = 0
    const childs = []
    const colorIterator = helpers.iterColor()
    for (const command of commands) {

      // Log process
      if (!quiet) {
        console.log(`[run] Launched "${command.code}"\n`)
      }

      // Data handler
      const createOnLine = (command, color, subprocess) => (line) => {
        printLine(line, command.name, {multiplex, quiet})
      }

      // Close handler
      const createOnClose = (command, color, subprocess) => (code) => {

        // Failed process
        if (code !== 0) {
            const message = `[run] Command "${command.code}" has failed`
            helpers.print_message('general', {message})
            process.exit(1)
        }

        // All finished
        closed += 1
        if (commands.length === closed) {
          resolve()
        }

      }

      // Create process
      const stdio = 'pipe'
      const color = colorIterator.next().value
      const splitter = new StreamSplitter('\n')
      const subprocess = spawn(command.code, {shell: true, env: environ, stdio})
      splitter.on('token', createOnLine(command, color, subprocess));
      subprocess.on('close', createOnClose(command, color, subprocess));
      subprocess.stdout.pipe(splitter)
      subprocess.stderr.pipe(splitter)

    }
  })
}


// Internal

function printLine(line, name, color, {multiplex, quiet}) {
  line = line.replace('\r\n', '\n')
  if (multiplex && !quiet) {
    process.stdout.write(chalk[color](`${name} | `))
  }
  process.stdout.write(line)
  process.stdout.flush()
}


// System

module.exports = {
  executeSync,
  executeAsync,
}
