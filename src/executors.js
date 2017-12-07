const chalk = require('chalk')
const StreamSplitter = require('stream-splitter')
const {spawn, spawnSync} = require('child_process')
const {applyFaketty} = require('./faketty')
const helpers = require('./helpers')


// Module API

function executeSync(commands, {environ, quiet}={}) {
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
      helpers.printMessage('general', {message})
      process.exit(1)
    }

    // Update environ
    if (command.variable) {
      environ[command.variable] = result.stdout.toString().trim()
    }

  }
}


async function executeAsync(commands, {environ, multiplex, quiet, faketty}={}) {
  return new Promise((resolve) => {

    // Data handler
    const createOnLine = (command, color) => (line) => {
      // TODO: in parallel mode buffer secondary commands output
      line = `${line.toString()}\n`
      printLine(line, command.name, color, {multiplex, quiet})
    }

    // Close handler
    const createOnClose = (command) => (code) => {

      // Failed process
      if (code !== 0) {
        const message = `[run] Command "${command.code}" has failed`
        helpers.printMessage('general', {message})
        process.exit(1)
      }

      // All finished
      finishedCount += 1
      if (commands.length === finishedCount) {
        resolve()
      }

    }

    // Execute commands
    let finishedCount = 0
    const colorIterator = helpers.iterColors()
    for (const command of commands) {

      // Log process
      if (!quiet) {
        console.log(`[run] Launched "${command.code}"`)
      }

      // Create process
      const stdio = 'pipe'
      const color = colorIterator.next().value
      const splitter = new StreamSplitter('\n')
      const code = applyFaketty(command.code, {faketty})
      const subprocess = spawn(code, {shell: true, env: environ, stdio})
      splitter.on('token', createOnLine(command, color, subprocess))
      subprocess.on('close', createOnClose(command, color, subprocess))
      subprocess.stdout.pipe(splitter)
      subprocess.stderr.pipe(splitter)

    }
  })
}


// Internal

function printLine(line, name, color, {multiplex, quiet}={}) {
  line = line.replace('\r\n', '\n')
  if (multiplex && !quiet) {
    process.stdout.write(chalk[color](`${name} | `))
  }
  process.stdout.write(line)
}


// System

module.exports = {
  executeSync,
  executeAsync,
}
