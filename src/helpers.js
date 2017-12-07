const fs = require('fs')
const yaml = require('js-yaml')
const chalk = require('chalk')


// Module API

function readConfig(path='run.yml') {

  // Bad file
  if (!fs.existsSync(path)) {
    const message = `No "${path}" found`
    printMessage('general', {message})
    process.exit(1)
  }

  // Read documents
  const documents = []
  const contents = fs.readFileSync(path, 'utf8')
  yaml.safeLoadAll(contents, doc => documents.push(doc))

  // Get config
  let comments = []
  const config = {run: []}
  const rawConfig = documents[0]
  for (const line of contents.split('\n')) {

    // Comment begin
    if (line.startsWith('# ')) {
      comments.push(line.replace('# ', ''))
      continue
    }

    // Add config item
    for (const [key, value] of Object.entries(rawConfig)) {
      if (line.startsWith(key)) {
        config.run.push({[key]: {code: value, desc: comments.join('\n')}})
      }
    }

    // Commend end
    if (!line.startsWith('# ')) {
      comments = []
    }
  }

  // Get options
  let options = {}
  if (documents.length > 1) {
    options = documents[1] || {}
  }

  return {config, options}
}


function printMessage(type, data) {
  const text = chalk.bold(data.message)
  console.log(text)
}


function* iterColors() {
  while (true) {
    for (const color of COLORS) {
      yield color
    }
  }
}


// Internal

const COLORS = [
  'cyan',
  'yellow',
  'green',
  'magenta',
  'red',
  'blue',
  'intense_cyan',
  'intense_yellow',
  'intense_green',
  'intense_magenta',
  'intense_red',
  'intense_blue',
]


// System

module.exports = {
  readConfig,
  printMessage,
  iterColors,
}
